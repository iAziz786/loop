import type { Project } from '../lib/types'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT, FRAMERATE, BUNDLED_TRACKS } from '../lib/constants'
import { loadFFmpeg, terminateFFmpeg } from './ffmpeg-manager'
import { renderFrame } from '../engine/canvas-renderer'
import { computeTotalDuration } from '../engine/transition'
import { fetchFile } from '@ffmpeg/util'

export interface RenderProgress {
  stage: 'loading' | 'preparing' | 'rendering' | 'done' | 'error'
  percent: number
  message: string
}

/**
 * Render video by drawing every frame through the canvas renderer (same engine
 * as the preview), then encoding them with FFmpeg. This guarantees the output
 * matches the preview exactly — zoom, CTAs, transitions, bookend fades all included.
 */
export async function renderVideo(
  project: Project,
  images: HTMLImageElement[],
  onProgress: (progress: RenderProgress) => void,
  signal: AbortSignal,
): Promise<Blob> {
  // Stage 1: Load FFmpeg
  onProgress({ stage: 'loading', percent: 0, message: 'Loading FFmpeg...' })

  if (signal.aborted) throw new Error('Cancelled')

  const ffmpeg = await loadFFmpeg()

  if (signal.aborted) throw new Error('Cancelled')

  const totalDuration = computeTotalDuration(project.screenshots, project.transitionDuration)
  const totalFrames = Math.ceil(totalDuration * FRAMERATE)

  // Stage 2: Render frames through canvas
  onProgress({ stage: 'preparing', percent: 5, message: 'Rendering frames...' })

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH
  canvas.height = OUTPUT_HEIGHT
  const ctx = canvas.getContext('2d')!

  for (let i = 0; i < totalFrames; i++) {
    if (signal.aborted) {
      terminateFFmpeg()
      throw new Error('Cancelled')
    }

    const time = i / FRAMERATE
    renderFrame(ctx, project, time, images)

    // Export frame as JPEG
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.92,
      )
    })
    const data = new Uint8Array(await blob.arrayBuffer())
    const filename = `frame_${String(i).padStart(6, '0')}.jpg`
    await ffmpeg.writeFile(filename, data)

    // Update progress (frames phase: 5% to 60%)
    const framePct = 5 + (i / totalFrames) * 55
    if (i % 10 === 0) {
      onProgress({
        stage: 'preparing',
        percent: framePct,
        message: `Rendering frame ${i + 1}/${totalFrames}...`,
      })
    }
  }

  // Stage 3: Write audio
  onProgress({ stage: 'preparing', percent: 60, message: 'Preparing audio...' })

  if (project.music.source === 'custom' && project.music.customFile) {
    const audioData = await fetchFile(project.music.customFile)
    await ffmpeg.writeFile('audio.mp3', audioData)
  } else {
    const track = BUNDLED_TRACKS[project.music.trackIndex]
    const response = await fetch(track.path)
    if (!response.ok) {
      await ffmpeg.writeFile('audio.mp3', createSilentAudio())
    } else {
      const audioData = new Uint8Array(await response.arrayBuffer())
      await ffmpeg.writeFile('audio.mp3', audioData)
    }
  }

  if (signal.aborted) {
    terminateFFmpeg()
    throw new Error('Cancelled')
  }

  // Stage 4: Encode with FFmpeg
  onProgress({ stage: 'rendering', percent: 65, message: 'Encoding video...' })

  const fadeOutStart = Math.max(0, totalDuration - project.music.fadeOutDuration)
  const audioFilter =
    `aloop=loop=-1:size=2e+09,` +
    `atrim=0:${totalDuration.toFixed(3)},` +
    `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${project.music.fadeOutDuration},` +
    `volume=${project.music.volume.toFixed(2)}`

  const args = [
    '-framerate', String(FRAMERATE),
    '-i', 'frame_%06d.jpg',
    '-i', 'audio.mp3',
    '-af', audioFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-y', 'output.mp4',
  ]

  // Listen for encoding progress
  ffmpeg.on('log', ({ message }) => {
    const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
    if (timeMatch) {
      const secs = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3])
      const pct = totalDuration > 0 ? 65 + Math.min(30, (secs / totalDuration) * 30) : 65
      onProgress({ stage: 'rendering', percent: pct, message: `Encoding video... ${Math.round(pct)}%` })
    }
  })

  try {
    await ffmpeg.exec(args)
  } catch (err) {
    throw new Error(`FFmpeg encoding failed: ${err}`)
  }

  if (signal.aborted) {
    terminateFFmpeg()
    throw new Error('Cancelled')
  }

  // Stage 5: Read output
  onProgress({ stage: 'rendering', percent: 96, message: 'Reading output...' })

  const outputData = await ffmpeg.readFile('output.mp4')
  const blob = new Blob([outputData], { type: 'video/mp4' })

  // Clean up virtual FS
  for (let i = 0; i < totalFrames; i++) {
    try { await ffmpeg.deleteFile(`frame_${String(i).padStart(6, '0')}.jpg`) } catch {}
  }
  try { await ffmpeg.deleteFile('audio.mp3') } catch {}
  try { await ffmpeg.deleteFile('output.mp4') } catch {}

  onProgress({ stage: 'done', percent: 100, message: 'Done!' })
  return blob
}

function createSilentAudio(): Uint8Array {
  return new Uint8Array([
    0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ])
}
