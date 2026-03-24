import type { Project, Screenshot } from '../lib/types'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from '../lib/constants'
import {
  computeViewport,
  canvasToViewport,
  interpolateCrossfadeViewports,
} from './zoom-animator'
import { computeCtaState } from './cta-animator'
import { computeFrameState } from './transition'

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/**
 * Render a single frame of the video preview at the given global time.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  globalTime: number,
  images: HTMLImageElement[],
): void {
  const { screenshots, transitionDuration, bookendFadeDuration } = project
  const width = OUTPUT_WIDTH
  const height = OUTPUT_HEIGHT

  // Clear to black
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  if (screenshots.length === 0 || images.length === 0) return

  const frame = computeFrameState(globalTime, screenshots, transitionDuration, bookendFadeDuration)

  if (frame.nextIndex !== null && frame.crossfadeProgress !== null) {
    // --- CROSSFADE with shared camera motion ---
    // Both screenshots follow the same normalized camera path so the move stays
    // continuous while the images crossfade.

    const current = screenshots[frame.screenshotIndex]
    const next = screenshots[frame.nextIndex]
    const currentImg = images[frame.screenshotIndex]
    const nextImg = images[frame.nextIndex]
    const fadeT = frame.crossfadeProgress
    const cameraT = easeInOut(fadeT)

    if (current && next && currentImg && nextImg) {
      const currentFullViewport = computeViewport(
        null, 0, currentImg.naturalWidth, currentImg.naturalHeight,
      )
      const nextFullViewport = computeViewport(
        null, 0, nextImg.naturalWidth, nextImg.naturalHeight,
      )
      const currentLiveViewport = computeViewport(
        current.zoom,
        frame.localTime,
        currentImg.naturalWidth,
        currentImg.naturalHeight,
      )
      const nextLiveViewport = computeViewport(
        next.zoom,
        fadeT * transitionDuration,
        nextImg.naturalWidth,
        nextImg.naturalHeight,
      )
      const { currentViewport, nextViewport } = interpolateCrossfadeViewports(
        currentLiveViewport,
        currentFullViewport,
        nextLiveViewport,
        nextFullViewport,
        cameraT,
      )

      ctx.globalAlpha = 1
      ctx.drawImage(currentImg,
        currentViewport.sx, currentViewport.sy, currentViewport.sw, currentViewport.sh,
        0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)

      ctx.globalAlpha = fadeT
      ctx.drawImage(nextImg,
        nextViewport.sx, nextViewport.sy, nextViewport.sw, nextViewport.sh,
        0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)

      ctx.globalAlpha = 1
    }
  } else {
    // --- Normal rendering (no crossfade) ---
    drawScreenshot(ctx, project, frame.screenshotIndex, frame.localTime, images, frame.alpha)
  }

  // Bookend fade overlay
  if (frame.bookendFadeAlpha < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - frame.bookendFadeAlpha})`
    ctx.fillRect(0, 0, width, height)
  }
}

function drawScreenshot(
  ctx: CanvasRenderingContext2D,
  project: Project,
  index: number,
  localTime: number,
  images: HTMLImageElement[],
  alpha: number,
): void {
  const screenshot = project.screenshots[index]
  const img = images[index]
  if (!screenshot || !img) return

  // Full viewport (unzoomed center-crop)
  const fullViewport = computeViewport(null, 0, img.naturalWidth, img.naturalHeight)

  // Current viewport (with zoom animation based on localTime)
  const currentViewport = computeViewport(
    screenshot.zoom,
    localTime,
    img.naturalWidth,
    img.naturalHeight,
  )

  ctx.globalAlpha = alpha
  ctx.drawImage(
    img,
    currentViewport.sx,
    currentViewport.sy,
    currentViewport.sw,
    currentViewport.sh,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  )

  // Draw zoom target indicator (visible before and during zoom animation, fades out as zoom completes)
  if (screenshot.zoom && localTime < screenshot.zoom.animateInDuration + 0.5) {
    const zoomProgress = Math.min(1, localTime / screenshot.zoom.animateInDuration)
    const indicatorAlpha = Math.max(0, 1 - zoomProgress * 1.2) // fades out as zoom completes

    if (indicatorAlpha > 0) {
      // Transform zoom center from full-canvas space to current viewport
      const zoomCenter = canvasToViewport(
        screenshot.zoom.centerX,
        screenshot.zoom.centerY,
        fullViewport,
        currentViewport,
      )

      if (zoomCenter) {
        const cx = zoomCenter.x * OUTPUT_WIDTH
        const cy = zoomCenter.y * OUTPUT_HEIGHT

        ctx.save()
        ctx.globalAlpha = alpha * indicatorAlpha * 0.7

        // Crosshair lines
        const crossLen = 20
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(cx - crossLen, cy)
        ctx.lineTo(cx + crossLen, cy)
        ctx.moveTo(cx, cy - crossLen)
        ctx.lineTo(cx, cy + crossLen)
        ctx.stroke()
        ctx.setLineDash([])

        // Target circle
        ctx.beginPath()
        ctx.arc(cx, cy, 8, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Zoom level label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.font = '12px system-ui, sans-serif'
        ctx.fillText(`${screenshot.zoom.level.toFixed(1)}x`, cx + 14, cy - 10)

        ctx.restore()
      }
    }
  }

  // Draw CTA animations — transform positions from full-canvas space to current viewport
  const zoomDoneTime = screenshot.zoom ? screenshot.zoom.animateInDuration : 0
  const ctaState = computeCtaState(
    screenshot.clicks,
    localTime,
    zoomDoneTime,
    screenshot.duration,
  )

  // Draw ripples (transformed to viewport)
  for (const ripple of ctaState.ripples) {
    const pos = canvasToViewport(ripple.x, ripple.y, fullViewport, currentViewport)
    if (pos) {
      drawRipple(ctx, pos.x, pos.y, ripple.progress)
    }
  }

  // Draw cursor (transformed to viewport)
  if (ctaState.cursor?.visible) {
    const pos = canvasToViewport(ctaState.cursor.x, ctaState.cursor.y, fullViewport, currentViewport)
    if (pos) {
      drawCursor(ctx, pos.x, pos.y)
    }
  }

  ctx.globalAlpha = 1
}

function drawCursor(ctx: CanvasRenderingContext2D, nx: number, ny: number): void {
  const x = nx * OUTPUT_WIDTH
  const y = ny * OUTPUT_HEIGHT
  const s = 36 // cursor size — bold and visible

  ctx.save()

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 3

  // macOS-style pointer shape
  ctx.beginPath()
  ctx.moveTo(x, y)                           // tip
  ctx.lineTo(x, y + s * 0.82)               // down the left edge
  ctx.lineTo(x + s * 0.2, y + s * 0.65)     // notch inward
  ctx.lineTo(x + s * 0.38, y + s * 1.0)     // tail bottom-right
  ctx.lineTo(x + s * 0.52, y + s * 0.92)    // tail top-right
  ctx.lineTo(x + s * 0.32, y + s * 0.58)    // notch top
  ctx.lineTo(x + s * 0.58, y + s * 0.58)    // right wing
  ctx.closePath()

  // White fill
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  // Reset shadow before stroke
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Black border
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.stroke()

  ctx.restore()
}

function drawRipple(
  ctx: CanvasRenderingContext2D,
  nx: number,
  ny: number,
  progress: number,
): void {
  const x = nx * OUTPUT_WIDTH
  const y = ny * OUTPUT_HEIGHT
  const maxRadius = 55
  const radius = maxRadius * progress
  const opacity = Math.max(0, 1 - progress)

  ctx.save()

  // Filled pulse (fading out)
  if (progress < 0.6) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(59, 130, 246, ${opacity * 0.15})`
    ctx.fill()
  }

  // Outer ring — bold
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.9})`
  ctx.lineWidth = 4
  ctx.stroke()

  // Middle ring
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.5})`
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Center dot
  if (progress < 0.5) {
    const dotOpacity = (1 - progress * 2) * 0.9
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(59, 130, 246, ${dotOpacity})`
    ctx.fill()
    // White inner dot
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${dotOpacity})`
    ctx.fill()
  }

  ctx.restore()
}
