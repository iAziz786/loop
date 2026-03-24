import type { Project, Screenshot, MusicConfig, ClickCTA, ZoomConfig } from './types'
import {
  DEFAULT_DURATION,
  DEFAULT_VOLUME,
  ZOOM_ANIMATE_IN_DURATION,
  SCREENSHOT_WARNING_THRESHOLD,
} from './constants'
import { computeTotalDuration, validateAndAdjust } from './timing'
import { computeStartTimes } from '../engine/transition'
import { downscaleIfNeeded, createThumbnail, shouldWarnCropLoss } from './image'
import { computeChecksum } from './checksum'
import { saveProject, loadProject, clearPersistedProject } from './persistence'

function createEmptyProject(): Project {
  return {
    version: 1,
    screenshots: [],
    music: {
      source: 'default',
      trackIndex: 0,
      customFile: null,
      volume: DEFAULT_VOLUME,
      fadeOutDuration: 2,
    },
    outputResolution: { width: 1920, height: 1080 },
    framerate: 30,
    transitionDuration: 0.5,
    bookendFadeDuration: 0.5,
  }
}

let project = $state<Project>(createEmptyProject())
let selectedScreenshotId = $state<string | null>(null)
let seekRequest = $state<{ time: number; counter: number }>({ time: 0, counter: 0 })

export const projectState = {
  get project() {
    return project
  },
  get selectedScreenshotId() {
    return selectedScreenshotId
  },
  get selectedScreenshot(): Screenshot | null {
    if (!selectedScreenshotId) return null
    return project.screenshots.find((s) => s.id === selectedScreenshotId) ?? null
  },
  get totalDuration(): number {
    return computeTotalDuration(project.screenshots, project.transitionDuration)
  },
  get memoryWarning(): boolean {
    return project.screenshots.length >= SCREENSHOT_WARNING_THRESHOLD
  },
  get screenshotCount(): number {
    return project.screenshots.length
  },
  get seekRequest() {
    return seekRequest
  },
}

let idCounter = 0
function generateId(): string {
  return `screenshot_${Date.now()}_${idCounter++}`
}

export async function addScreenshot(file: File): Promise<void> {
  const { blob, width, height } = await downscaleIfNeeded(file)
  const [checksum, thumbnailUrl] = await Promise.all([
    computeChecksum(new File([blob], file.name, { type: blob.type })),
    createThumbnail(blob),
  ])

  const screenshot: Screenshot = {
    id: generateId(),
    file: new File([blob], file.name, { type: blob.type }),
    filename: file.name,
    checksum,
    duration: DEFAULT_DURATION,
    zoom: null,
    clicks: [],
    thumbnailUrl,
    originalWidth: width,
    originalHeight: height,
  }

  project.screenshots = [...project.screenshots, screenshot]

  // Auto-select first screenshot
  if (project.screenshots.length === 1) {
    selectedScreenshotId = screenshot.id
  }

  scheduleSave()
}

let copiedScreenshotId: string | null = null

export function copyScreenshot(): boolean {
  if (!selectedScreenshotId) return false
  copiedScreenshotId = selectedScreenshotId
  return true
}

export function pasteScreenshot(): void {
  if (!copiedScreenshotId) return
  const source = project.screenshots.find((s) => s.id === copiedScreenshotId)
  if (!source) return

  const clone: Screenshot = {
    ...source,
    id: generateId(),
    zoom: source.zoom ? { ...source.zoom } : null,
    clicks: source.clicks.map((c) => ({ ...c })),
  }

  // Insert right after the currently selected screenshot
  const selectedIdx = project.screenshots.findIndex((s) => s.id === selectedScreenshotId)
  const insertIdx = selectedIdx >= 0 ? selectedIdx + 1 : project.screenshots.length
  const items = [...project.screenshots]
  items.splice(insertIdx, 0, clone)
  project.screenshots = items
  selectedScreenshotId = clone.id
  scheduleSave()
}

export function removeScreenshot(id: string): void {
  project.screenshots = project.screenshots.filter((s) => s.id !== id)
  if (selectedScreenshotId === id) {
    selectedScreenshotId = project.screenshots[0]?.id ?? null
  }
  scheduleSave()
}

export function reorderScreenshots(fromIndex: number, toIndex: number): void {
  const items = [...project.screenshots]
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)
  project.screenshots = items
  scheduleSave()
}

export function selectScreenshot(id: string | null): void {
  selectedScreenshotId = id
  scheduleSave()
}

export function selectAndSeekToScreenshot(id: string): void {
  selectedScreenshotId = id
  const index = project.screenshots.findIndex((s) => s.id === id)
  if (index < 0) return
  const starts = computeStartTimes(project.screenshots, project.transitionDuration)
  const screenshotStart = starts[index]
  const screenshotEnd = screenshotStart + project.screenshots[index].duration
  // Seek to when the selected screenshot is fully established on screen.
  const preferredTime = index === 0
    ? screenshotStart + project.bookendFadeDuration
    : screenshotStart + project.transitionDuration
  const seekTime = Math.min(preferredTime, Math.max(screenshotStart, screenshotEnd - 0.001))
  seekRequest = { time: seekTime, counter: seekRequest.counter + 1 }
}

export function updateScreenshot(id: string, partial: Partial<Screenshot>): void {
  project.screenshots = project.screenshots.map((s) => {
    if (s.id !== id) return s
    const updated = { ...s, ...partial }
    return validateAndAdjust(updated)
  })
  scheduleSave()
}

export function setZoom(id: string, zoom: ZoomConfig | null): void {
  updateScreenshot(id, { zoom })
}

export function addClick(id: string, click: ClickCTA): void {
  const screenshot = project.screenshots.find((s) => s.id === id)
  if (!screenshot) return
  updateScreenshot(id, { clicks: [...screenshot.clicks, click] })
}

export function removeClick(id: string, clickIndex: number): void {
  const screenshot = project.screenshots.find((s) => s.id === id)
  if (!screenshot) return
  updateScreenshot(id, {
    clicks: screenshot.clicks.filter((_, i) => i !== clickIndex),
  })
}

export function setMusic(partial: Partial<MusicConfig>): void {
  project.music = { ...project.music, ...partial }
  scheduleSave()
}

export function resetProject(): void {
  project = createEmptyProject()
  selectedScreenshotId = null
}

export async function clearProject(): Promise<void> {
  resetProject()
  await clearPersistedProject()
}

export async function restoreProject(): Promise<boolean> {
  restoringState = true
  try {
    const saved = await loadProject()
    if (!saved) return false
    project = saved.project
    selectedScreenshotId = saved.selectedScreenshotId
    return true
  } finally {
    restoringState = false
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null
let restoringState = false

function getSnapshotForSave(): { project: Project; selectedId: string | null } {
  // Use $state.snapshot to unwrap Svelte 5 proxies before passing to IndexedDB
  const snap = $state.snapshot(project) as Project
  // $state.snapshot deep-clones plain data but File/Blob become plain objects.
  // Re-attach the original File references from the proxy.
  for (let i = 0; i < snap.screenshots.length; i++) {
    snap.screenshots[i].file = project.screenshots[i].file
  }
  if (project.music.customFile) {
    snap.music.customFile = project.music.customFile
  }
  return { project: snap, selectedId: selectedScreenshotId }
}

function scheduleSave(): void {
  if (restoringState) return
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    const { project: snap, selectedId } = getSnapshotForSave()
    saveProject(snap, selectedId).catch(() => {})
  }, 300)
}

function flushSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  const { project: snap, selectedId } = getSnapshotForSave()
  saveProject(snap, selectedId).catch(() => {})
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushSave())
}

export function setProjectFromImport(imported: Project): void {
  project = imported
  selectedScreenshotId = imported.screenshots[0]?.id ?? null
  scheduleSave()
}

export function getCropWarning(screenshot: Screenshot): boolean {
  return shouldWarnCropLoss(screenshot.originalWidth, screenshot.originalHeight)
}
