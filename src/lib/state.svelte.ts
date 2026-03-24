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
}

export function removeScreenshot(id: string): void {
  project.screenshots = project.screenshots.filter((s) => s.id !== id)
  if (selectedScreenshotId === id) {
    selectedScreenshotId = project.screenshots[0]?.id ?? null
  }
}

export function reorderScreenshots(fromIndex: number, toIndex: number): void {
  const items = [...project.screenshots]
  const [moved] = items.splice(fromIndex, 1)
  items.splice(toIndex, 0, moved)
  project.screenshots = items
}

export function selectScreenshot(id: string | null): void {
  selectedScreenshotId = id
}

export function selectAndSeekToScreenshot(id: string): void {
  selectedScreenshotId = id
  const index = project.screenshots.findIndex((s) => s.id === id)
  if (index < 0) return
  const starts = computeStartTimes(project.screenshots, project.transitionDuration)
  // Offset past the bookend fade-in for the first screenshot so it's not black
  const seekTime = index === 0
    ? starts[0] + project.bookendFadeDuration
    : starts[index]
  seekRequest = { time: seekTime, counter: seekRequest.counter + 1 }
}

export function updateScreenshot(id: string, partial: Partial<Screenshot>): void {
  project.screenshots = project.screenshots.map((s) => {
    if (s.id !== id) return s
    const updated = { ...s, ...partial }
    return validateAndAdjust(updated)
  })
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
}

export function resetProject(): void {
  project = createEmptyProject()
  selectedScreenshotId = null
}

export function setProjectFromImport(imported: Project): void {
  project = imported
  selectedScreenshotId = imported.screenshots[0]?.id ?? null
}

export function getCropWarning(screenshot: Screenshot): boolean {
  return shouldWarnCropLoss(screenshot.originalWidth, screenshot.originalHeight)
}
