import type { ClickCTA } from '../lib/types'
import { CTA_ANIMATION_DURATION } from '../lib/constants'

export interface CursorState {
  x: number
  y: number
  visible: boolean
}

export interface RippleState {
  x: number
  y: number
  progress: number // 0-1, how far the ripple has expanded
}

export interface CtaAnimationState {
  cursor: CursorState | null
  ripples: RippleState[]
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Compute CTA animation state for a given local time.
 * CTAs start after zoom completes. Each CTA takes CTA_ANIMATION_DURATION seconds.
 * Cursor travels for the first half, ripple expands for the second half.
 */
export function computeCtaState(
  clicks: ClickCTA[],
  localTime: number,
  zoomDoneTime: number,
  screenshotDuration: number,
): CtaAnimationState {
  if (clicks.length === 0) {
    return { cursor: null, ripples: [] }
  }

  const ctaStartTime = zoomDoneTime
  const availableTime = screenshotDuration - ctaStartTime - 0.5 // buffer before transition
  if (availableTime <= 0) {
    return { cursor: null, ripples: [] }
  }

  const spacing = availableTime / clicks.length
  const elapsed = localTime - ctaStartTime

  if (elapsed < 0) {
    return { cursor: null, ripples: [] }
  }

  const ripples: RippleState[] = []
  let cursor: CursorState | null = null

  const travelDuration = CTA_ANIMATION_DURATION * 0.4
  const rippleDuration = CTA_ANIMATION_DURATION * 0.6

  for (let i = 0; i < clicks.length; i++) {
    const ctaStart = i * spacing
    const ctaElapsed = elapsed - ctaStart

    if (ctaElapsed < 0) break
    if (ctaElapsed > CTA_ANIMATION_DURATION) {
      // This CTA is done — add a fading ripple if still visible
      const rippleAge = ctaElapsed - travelDuration
      if (rippleAge < rippleDuration * 1.5) {
        ripples.push({
          x: clicks[i].x,
          y: clicks[i].y,
          progress: Math.min(1, rippleAge / rippleDuration),
        })
      }
      continue
    }

    // Determine cursor position
    if (ctaElapsed <= travelDuration) {
      // Cursor is traveling
      const travelProgress = easeOut(ctaElapsed / travelDuration)
      const startX = i === 0 ? 1.1 : clicks[i - 1].x // bottom-right or previous CTA
      const startY = i === 0 ? 1.1 : clicks[i - 1].y
      cursor = {
        x: startX + (clicks[i].x - startX) * travelProgress,
        y: startY + (clicks[i].y - startY) * travelProgress,
        visible: true,
      }
    } else {
      // Cursor arrived, ripple expanding
      cursor = { x: clicks[i].x, y: clicks[i].y, visible: true }
      const rippleElapsed = ctaElapsed - travelDuration
      ripples.push({
        x: clicks[i].x,
        y: clicks[i].y,
        progress: Math.min(1, rippleElapsed / rippleDuration),
      })
    }
  }

  return { cursor, ripples }
}
