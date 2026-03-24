import type { Screenshot } from '../lib/types'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from '../lib/constants'
import { computeViewport } from './zoom-animator'

/**
 * Render the edit mode view for a screenshot.
 * Shows the full image with zoom region and CTA markers overlaid.
 */
export function renderEditFrame(
  ctx: CanvasRenderingContext2D,
  screenshot: Screenshot,
  image: HTMLImageElement,
): void {
  const w = OUTPUT_WIDTH
  const h = OUTPUT_HEIGHT

  // Clear
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  if (!image.naturalWidth) return

  // Draw the full image (center-cropped to fill)
  const fullViewport = computeViewport(null, 0, image.naturalWidth, image.naturalHeight)
  ctx.drawImage(
    image,
    fullViewport.sx, fullViewport.sy, fullViewport.sw, fullViewport.sh,
    0, 0, w, h,
  )

  // Darken area outside zoom region if zoom is enabled
  if (screenshot.zoom) {
    const zoomedViewport = computeViewport(
      { ...screenshot.zoom, animateInDuration: 0 }, // instant zoom to see final region
      1, // fully zoomed
      image.naturalWidth,
      image.naturalHeight,
    )

    // Convert image-space zoom viewport to canvas-space coordinates
    // The full viewport maps to (0,0)-(w,h), so we need to transform
    const scaleX = w / fullViewport.sw
    const scaleY = h / fullViewport.sh
    const zx = (zoomedViewport.sx - fullViewport.sx) * scaleX
    const zy = (zoomedViewport.sy - fullViewport.sy) * scaleY
    const zw = zoomedViewport.sw * scaleX
    const zh = zoomedViewport.sh * scaleY

    // Draw semi-transparent overlay on the entire canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, w, h)

    // Cut out the zoom region by redrawing the image in that area
    ctx.save()
    ctx.beginPath()
    ctx.rect(zx, zy, zw, zh)
    ctx.clip()
    ctx.drawImage(
      image,
      fullViewport.sx, fullViewport.sy, fullViewport.sw, fullViewport.sh,
      0, 0, w, h,
    )
    ctx.restore()

    // Draw zoom region border
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3
    ctx.setLineDash([8, 4])
    ctx.strokeRect(zx, zy, zw, zh)
    ctx.setLineDash([])

    // Draw zoom center crosshair
    const cx = screenshot.zoom.centerX * w
    const cy = screenshot.zoom.centerY * h
    const crossSize = 12
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - crossSize, cy)
    ctx.lineTo(cx + crossSize, cy)
    ctx.moveTo(cx, cy - crossSize)
    ctx.lineTo(cx, cy + crossSize)
    ctx.stroke()

    // Zoom level label
    ctx.fillStyle = '#3b82f6'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.fillText(`${screenshot.zoom.level.toFixed(1)}x`, zx + 8, zy + 20)
  }

  // Draw CTA markers
  for (let i = 0; i < screenshot.clicks.length; i++) {
    const click = screenshot.clicks[i]
    const cx = click.x * w
    const cy = click.y * h

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, 18, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)' // purple
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Inner filled dot
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)'
    ctx.fill()

    // Number label
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), cx, cy)

    // Connector line from previous CTA or from bottom-right
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (i === 0) {
      // Line from bottom-right corner (cursor entry point)
      ctx.moveTo(w + 10, h + 10)
    } else {
      ctx.moveTo(screenshot.clicks[i - 1].x * w, screenshot.clicks[i - 1].y * h)
    }
    ctx.lineTo(cx, cy)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Reset text alignment
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}
