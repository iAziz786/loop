import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let loading = false

export function checkSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined'
}

export async function loadFFmpeg(
  onLog?: (message: string) => void,
): Promise<FFmpeg> {
  if (!checkSharedArrayBuffer()) {
    throw new Error(
      'SharedArrayBuffer is not available. Ensure your server sends the required COOP/COEP headers:\n' +
        'Cross-Origin-Opener-Policy: same-origin\n' +
        'Cross-Origin-Embedder-Policy: require-corp',
    )
  }

  if (loading) {
    while (loading) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (ffmpegInstance) return ffmpegInstance
  }

  // Always create a fresh instance — FFmpeg.wasm worker dies after exec() completes
  // (it logs "Aborted()" and the worker becomes unresponsive for subsequent calls)
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate()
    } catch {}
    ffmpegInstance = null
  }

  loading = true
  try {
    const ffmpeg = new FFmpeg()

    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message))
    }

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegInstance = ffmpeg
    return ffmpeg
  } finally {
    loading = false
  }
}

export function terminateFFmpeg(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate()
    } catch {}
    ffmpegInstance = null
  }
}
