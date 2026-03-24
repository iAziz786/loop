import type { Project, Screenshot, MusicConfig } from './types'

const DB_NAME = 'loop-project'
const DB_VERSION = 1
const STORE_NAME = 'state'
const PROJECT_KEY = 'current-project'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

interface PersistedScreenshot {
  id: string
  filename: string
  checksum: string
  duration: number
  zoom: Screenshot['zoom']
  clicks: Screenshot['clicks']
  thumbnailUrl: string
  originalWidth: number
  originalHeight: number
  fileBlob: Blob | null
  fileType: string
}

interface PersistedProject {
  version: 1
  screenshots: PersistedScreenshot[]
  music: {
    source: 'default' | 'custom'
    trackIndex: number
    customFileBlob: Blob | null
    customFileName: string | null
    volume: number
    fadeOutDuration: 2
  }
  outputResolution: { width: 1920; height: 1080 }
  framerate: 30
  transitionDuration: number
  bookendFadeDuration: number
  selectedScreenshotId: string | null
}

export async function saveProject(project: Project, selectedScreenshotId: string | null): Promise<void> {
  const persisted: PersistedProject = {
    version: project.version,
    screenshots: project.screenshots.map((s) => ({
      id: s.id,
      filename: s.filename,
      checksum: s.checksum,
      duration: s.duration,
      zoom: s.zoom,
      clicks: s.clicks,
      thumbnailUrl: s.thumbnailUrl,
      originalWidth: s.originalWidth,
      originalHeight: s.originalHeight,
      fileBlob: s.file ? new Blob([s.file], { type: s.file.type }) : null,
      fileType: s.file?.type ?? 'image/png',
    })),
    music: {
      source: project.music.source,
      trackIndex: project.music.trackIndex,
      customFileBlob: project.music.customFile
        ? new Blob([project.music.customFile], { type: project.music.customFile.type })
        : null,
      customFileName: project.music.customFile?.name ?? null,
      volume: project.music.volume,
      fadeOutDuration: project.music.fadeOutDuration,
    },
    outputResolution: project.outputResolution,
    framerate: project.framerate,
    transitionDuration: project.transitionDuration,
    bookendFadeDuration: project.bookendFadeDuration,
    selectedScreenshotId,
  }

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(persisted, PROJECT_KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadProject(): Promise<{ project: Project; selectedScreenshotId: string | null } | null> {
  try {
    const db = await openDB()
    const persisted = await new Promise<PersistedProject | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(PROJECT_KEY)
      request.onsuccess = () => { db.close(); resolve(request.result) }
      request.onerror = () => { db.close(); reject(request.error) }
    })

    if (!persisted || !persisted.screenshots?.length) return null

    const screenshots: Screenshot[] = persisted.screenshots.map((s) => ({
      id: s.id,
      file: s.fileBlob ? new File([s.fileBlob], s.filename, { type: s.fileType }) : null,
      filename: s.filename,
      checksum: s.checksum,
      duration: s.duration,
      zoom: s.zoom,
      clicks: s.clicks,
      thumbnailUrl: s.thumbnailUrl,
      originalWidth: s.originalWidth,
      originalHeight: s.originalHeight,
    }))

    const music: MusicConfig = {
      source: persisted.music.source,
      trackIndex: persisted.music.trackIndex,
      customFile: persisted.music.customFileBlob && persisted.music.customFileName
        ? new File([persisted.music.customFileBlob], persisted.music.customFileName)
        : null,
      volume: persisted.music.volume,
      fadeOutDuration: persisted.music.fadeOutDuration,
    }

    const project: Project = {
      version: persisted.version,
      screenshots,
      music,
      outputResolution: persisted.outputResolution,
      framerate: persisted.framerate,
      transitionDuration: persisted.transitionDuration,
      bookendFadeDuration: persisted.bookendFadeDuration,
    }

    return { project, selectedScreenshotId: persisted.selectedScreenshotId }
  } catch {
    return null
  }
}

export async function clearPersistedProject(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(PROJECT_KEY)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch {
    // Ignore errors during clear
  }
}
