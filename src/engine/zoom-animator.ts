import type { ZoomConfig } from '../lib/types'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from '../lib/constants'

export interface Viewport {
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface CameraState {
  centerX: number
  centerY: number
  scale: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/**
 * Transform a point from "full canvas normalized" (0-1, as placed in edit mode on the
 * unzoomed center-cropped view) to "current viewport normalized" (0-1 on the canvas
 * showing the current viewport). Returns null if the point is outside the viewport.
 *
 * fullViewport: the center-crop viewport (no zoom)
 * currentViewport: the current viewport (with zoom animation applied)
 */
export function canvasToViewport(
  nx: number,
  ny: number,
  fullViewport: Viewport,
  currentViewport: Viewport,
): { x: number; y: number } | null {
  // Convert from canvas-normalized to image-pixel space via the full viewport
  const imgX = fullViewport.sx + nx * fullViewport.sw
  const imgY = fullViewport.sy + ny * fullViewport.sh

  // Convert from image-pixel space to current viewport canvas-normalized
  const vx = (imgX - currentViewport.sx) / currentViewport.sw
  const vy = (imgY - currentViewport.sy) / currentViewport.sh

  // Outside the current viewport
  if (vx < -0.1 || vx > 1.1 || vy < -0.1 || vy > 1.1) return null

  return { x: vx, y: vy }
}

export function viewportToCameraState(
  viewport: Viewport,
  fullViewport: Viewport,
): CameraState {
  return {
    centerX: ((viewport.sx + viewport.sw / 2) - fullViewport.sx) / fullViewport.sw,
    centerY: ((viewport.sy + viewport.sh / 2) - fullViewport.sy) / fullViewport.sh,
    scale: fullViewport.sw / viewport.sw,
  }
}

export function cameraStateToViewport(
  cameraState: CameraState,
  fullViewport: Viewport,
): Viewport {
  const scale = Math.max(1, cameraState.scale)
  const sw = fullViewport.sw / scale
  const sh = fullViewport.sh / scale
  const minCenterX = fullViewport.sx + sw / 2
  const maxCenterX = fullViewport.sx + fullViewport.sw - sw / 2
  const minCenterY = fullViewport.sy + sh / 2
  const maxCenterY = fullViewport.sy + fullViewport.sh - sh / 2
  const centerX = clamp(fullViewport.sx + cameraState.centerX * fullViewport.sw, minCenterX, maxCenterX)
  const centerY = clamp(fullViewport.sy + cameraState.centerY * fullViewport.sh, minCenterY, maxCenterY)

  return {
    sx: centerX - sw / 2,
    sy: centerY - sh / 2,
    sw,
    sh,
  }
}

export function interpolateCrossfadeViewports(
  currentViewport: Viewport,
  currentFullViewport: Viewport,
  nextViewport: Viewport,
  nextFullViewport: Viewport,
  t: number,
): {
  cameraState: CameraState
  currentViewport: Viewport
  nextViewport: Viewport
} {
  const currentState = viewportToCameraState(currentViewport, currentFullViewport)
  const nextState = viewportToCameraState(nextViewport, nextFullViewport)
  const cameraState = {
    centerX: currentState.centerX + (nextState.centerX - currentState.centerX) * t,
    centerY: currentState.centerY + (nextState.centerY - currentState.centerY) * t,
    scale: currentState.scale + (nextState.scale - currentState.scale) * t,
  }

  return {
    cameraState,
    currentViewport: cameraStateToViewport(cameraState, currentFullViewport),
    nextViewport: cameraStateToViewport(cameraState, nextFullViewport),
  }
}

/**
 * Compute the source viewport rectangle for drawing the image.
 * Returns coordinates in image-space (pixels on the source image).
 */
export function computeViewport(
  zoom: ZoomConfig | null,
  localTime: number,
  imgWidth: number,
  imgHeight: number,
): Viewport {
  // Full image viewport (center-crop to fill output)
  const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT
  const imgAspect = imgWidth / imgHeight

  let fullSw: number, fullSh: number, fullSx: number, fullSy: number

  if (imgAspect > targetAspect) {
    // Wider image — crop sides
    fullSh = imgHeight
    fullSw = imgHeight * targetAspect
    fullSx = (imgWidth - fullSw) / 2
    fullSy = 0
  } else {
    // Taller image — crop top/bottom
    fullSw = imgWidth
    fullSh = imgWidth / targetAspect
    fullSx = 0
    fullSy = (imgHeight - fullSh) / 2
  }

  if (!zoom) {
    return { sx: fullSx, sy: fullSy, sw: fullSw, sh: fullSh }
  }

  // Zoomed viewport
  const zoomedSw = fullSw / zoom.level
  const zoomedSh = fullSh / zoom.level

  // Center point in image coordinates
  const cx = zoom.centerX * imgWidth
  const cy = zoom.centerY * imgHeight

  // Clamp zoomed viewport so it stays within image bounds
  let zoomedSx = cx - zoomedSw / 2
  let zoomedSy = cy - zoomedSh / 2
  zoomedSx = Math.max(0, Math.min(imgWidth - zoomedSw, zoomedSx))
  zoomedSy = Math.max(0, Math.min(imgHeight - zoomedSh, zoomedSy))

  // Interpolate between full and zoomed viewport
  const progress = Math.min(1, localTime / zoom.animateInDuration)
  const easedProgress = easeInOut(progress)

  return {
    sx: fullSx + (zoomedSx - fullSx) * easedProgress,
    sy: fullSy + (zoomedSy - fullSy) * easedProgress,
    sw: fullSw + (zoomedSw - fullSw) * easedProgress,
    sh: fullSh + (zoomedSh - fullSh) * easedProgress,
  }
}
