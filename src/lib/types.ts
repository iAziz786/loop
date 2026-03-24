export interface Project {
  version: 1
  screenshots: Screenshot[]
  music: MusicConfig
  outputResolution: { width: 1920; height: 1080 }
  framerate: 30
  transitionDuration: 0.5
  bookendFadeDuration: 0.5
}

export interface Screenshot {
  id: string
  file: File | null
  filename: string
  checksum: string
  duration: number
  zoom: ZoomConfig | null
  clicks: ClickCTA[]
  thumbnailUrl: string
  originalWidth: number
  originalHeight: number
}

export interface ZoomConfig {
  centerX: number
  centerY: number
  level: number
  animateInDuration: number
}

export interface ClickCTA {
  x: number
  y: number
}

export interface MusicConfig {
  source: 'default' | 'custom'
  trackIndex: number
  customFile: File | null
  volume: number
  fadeOutDuration: 2
}
