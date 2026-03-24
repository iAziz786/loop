import type { Project } from '../lib/types'
import { BUNDLED_TRACKS } from '../lib/constants'
import { renderFrame } from './canvas-renderer'
import { computeTotalDuration } from './transition'

export class PlaybackController {
  private ctx: CanvasRenderingContext2D
  private project: Project
  private images: HTMLImageElement[]
  private animationId: number | null = null
  private startTimestamp: number = 0
  private pausedAt: number = 0
  private audio: HTMLAudioElement | null = null
  private audioUrl: string | null = null
  private lastMusicSource: string = ''
  private lastTrackIndex: number = -1

  currentTime = $state(0)
  isPlaying = $state(false)
  duration = $state(0)

  constructor(
    ctx: CanvasRenderingContext2D,
    project: Project,
    images: HTMLImageElement[],
  ) {
    this.ctx = ctx
    this.project = project
    this.images = images
    this.duration = computeTotalDuration(project.screenshots, project.transitionDuration)
    this.loadAudio()
  }

  updateProject(project: Project, images: HTMLImageElement[]): void {
    this.project = project
    this.images = images
    this.duration = computeTotalDuration(project.screenshots, project.transitionDuration)

    // Reload audio if music config changed
    this.loadAudio()
    this.syncAudioVolume()

    if (!this.isPlaying) {
      this.renderCurrentFrame()
    }
  }

  private loadAudio(): void {
    const { music } = this.project

    // Check if music config actually changed
    const musicChanged = music.source !== this.lastMusicSource
      || music.trackIndex !== this.lastTrackIndex
      || (music.source === 'custom' && music.customFile !== null)
    this.lastMusicSource = music.source
    this.lastTrackIndex = music.trackIndex

    let src: string | null = null
    if (music.source === 'custom' && music.customFile) {
      // Revoke previous blob URL
      if (this.audioUrl && this.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.audioUrl)
      }
      src = URL.createObjectURL(music.customFile)
      this.audioUrl = src
    } else {
      const track = BUNDLED_TRACKS[music.trackIndex]
      if (track) {
        src = track.path
        this.audioUrl = null
      }
    }

    if (!src) return

    if (!this.audio) {
      this.audio = new Audio()
      this.audio.loop = true // Loop for videos longer than the track
    }

    if (musicChanged) {
      this.audio.src = src
      this.audio.load()
    }

    this.syncAudioVolume()
  }

  private syncAudioVolume(): void {
    if (!this.audio) return
    this.audio.volume = this.project.music.volume
  }

  private syncAudioTime(): void {
    if (!this.audio) return
    // Only sync if drifted more than 0.3s to avoid constant interruption
    const drift = Math.abs(this.audio.currentTime - this.currentTime)
    if (drift > 0.3) {
      this.audio.currentTime = this.currentTime
    }
  }

  play(): void {
    if (this.isPlaying) return
    this.isPlaying = true
    this.startTimestamp = performance.now() - this.pausedAt * 1000

    if (this.audio) {
      this.audio.currentTime = this.pausedAt
      this.audio.play().catch(() => {}) // Ignore autoplay restrictions
    }

    this.tick(performance.now())
  }

  pause(): void {
    this.isPlaying = false
    this.pausedAt = this.currentTime
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    if (this.audio) {
      this.audio.pause()
    }
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause()
    } else {
      if (this.currentTime >= this.duration) {
        this.seek(0)
      }
      this.play()
    }
  }

  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(time, this.duration))
    this.pausedAt = this.currentTime
    this.startTimestamp = performance.now() - this.currentTime * 1000

    if (this.audio) {
      this.audio.currentTime = this.currentTime
    }

    this.renderCurrentFrame()
  }

  private tick = (timestamp: number): void => {
    if (!this.isPlaying) return

    this.currentTime = (timestamp - this.startTimestamp) / 1000

    if (this.currentTime >= this.duration) {
      this.currentTime = this.duration
      this.isPlaying = false
      this.pausedAt = 0
      if (this.audio) this.audio.pause()
      this.renderCurrentFrame()
      return
    }

    // Periodic audio time sync
    this.syncAudioTime()

    this.renderCurrentFrame()
    this.animationId = requestAnimationFrame(this.tick)
  }

  private renderCurrentFrame(): void {
    renderFrame(this.ctx, this.project, this.currentTime, this.images)
  }

  destroy(): void {
    this.pause()
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
    if (this.audioUrl && this.audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.audioUrl)
    }
  }
}
