import type { Project, Screenshot, MusicConfig } from './types'
import { DEFAULT_DURATION, DEFAULT_VOLUME } from './constants'
import { computeChecksum } from './checksum'
import { createThumbnail, downscaleIfNeeded } from './image'

interface SerializedScreenshot {
  id: string
  filename: string
  checksum: string
  duration: number
  zoom: Screenshot['zoom']
  clicks: Screenshot['clicks']
}

interface SerializedProject {
  version: 1
  screenshots: SerializedScreenshot[]
  music: {
    source: 'default' | 'custom'
    trackIndex: number
    volume: number
  }
}

export function exportConfig(project: Project): string {
  const serialized: SerializedProject = {
    version: project.version,
    screenshots: project.screenshots.map((s) => ({
      id: s.id,
      filename: s.filename,
      checksum: s.checksum,
      duration: s.duration,
      zoom: s.zoom,
      clicks: s.clicks,
    })),
    music: {
      source: project.music.source,
      trackIndex: project.music.trackIndex,
      volume: project.music.volume,
    },
  }
  return JSON.stringify(serialized, null, 2)
}

export function downloadConfig(project: Project): void {
  const json = exportConfig(project)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'loop-project.json'
  a.click()
  URL.revokeObjectURL(url)
}

export async function importConfig(
  json: string,
  files: File[],
): Promise<Project> {
  const parsed: SerializedProject = JSON.parse(json)

  if (parsed.version !== 1) {
    throw new Error(`Unsupported config version: ${parsed.version}`)
  }

  // Build filename -> File map
  const fileMap = new Map<string, File>()
  for (const file of files) {
    fileMap.set(file.name, file)
  }

  const screenshots: Screenshot[] = []

  for (const ss of parsed.screenshots) {
    const file = fileMap.get(ss.filename) ?? null

    if (file) {
      const { blob, width, height } = await downscaleIfNeeded(file)
      const checksum = await computeChecksum(new File([blob], file.name, { type: blob.type }))
      const thumbnailUrl = await createThumbnail(blob)

      // Warn if checksum doesn't match but still allow
      if (checksum !== ss.checksum) {
        console.warn(`Checksum mismatch for ${ss.filename}: expected ${ss.checksum}, got ${checksum}`)
      }

      screenshots.push({
        id: ss.id,
        file: new File([blob], file.name, { type: blob.type }),
        filename: ss.filename,
        checksum,
        duration: ss.duration,
        zoom: ss.zoom,
        clicks: ss.clicks,
        thumbnailUrl,
        originalWidth: width,
        originalHeight: height,
      })
    } else {
      // Missing file — create placeholder
      screenshots.push({
        id: ss.id,
        file: null,
        filename: ss.filename,
        checksum: ss.checksum,
        duration: ss.duration,
        zoom: ss.zoom,
        clicks: ss.clicks,
        thumbnailUrl: '',
        originalWidth: 0,
        originalHeight: 0,
      })
    }
  }

  return {
    version: 1,
    screenshots,
    music: {
      source: parsed.music.source,
      trackIndex: parsed.music.trackIndex,
      customFile: null,
      volume: parsed.music.volume,
      fadeOutDuration: 2,
    },
    outputResolution: { width: 1920, height: 1080 },
    framerate: 30,
    transitionDuration: 0.5,
    bookendFadeDuration: 0.5,
  }
}
