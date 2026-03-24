import type { Project } from '../lib/types'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from '../lib/constants'
import { computeViewport, canvasToViewport } from './zoom-animator'
import { computeCtaState } from './cta-animator'
import { computeFrameState } from './transition'

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

  // Draw current screenshot
  drawScreenshot(ctx, project, frame.screenshotIndex, frame.localTime, images, frame.alpha)

  // Draw next screenshot during crossfade
  if (frame.nextIndex !== null && frame.crossfadeProgress !== null) {
    drawScreenshot(ctx, project, frame.nextIndex, 0, images, frame.crossfadeProgress)
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

  // Full viewport (unzoomed center-crop) — this is what edit mode shows
  const fullViewport = computeViewport(null, 0, img.naturalWidth, img.naturalHeight)

  // Current viewport (with zoom animation)
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
  const size = 24

  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + size * 0.4, y + size * 0.9)
  ctx.lineTo(x + size * 0.15, y + size * 0.65)
  ctx.closePath()
  ctx.fill()
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
  const maxRadius = 40
  const radius = maxRadius * progress
  const opacity = 1 - progress

  // Outer ring
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.8})`
  ctx.lineWidth = 3
  ctx.stroke()

  // Inner ring
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.4})`
  ctx.lineWidth = 2
  ctx.stroke()

  // Center dot
  if (progress < 0.5) {
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(59, 130, 246, ${(1 - progress * 2) * 0.8})`
    ctx.fill()
  }
}
