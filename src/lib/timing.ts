import type { Screenshot } from './types'
import {
  TRANSITION_DURATION,
  CTA_ANIMATION_DURATION,
  ZOOM_ANIMATE_IN_DURATION,
  MIN_DURATION,
  MAX_DURATION,
} from './constants'

export interface CtaWindow {
  start: number
  end: number
}

export interface CtaTimingResult {
  windows: CtaWindow[]
  canAddMore: boolean
  warning: string | null
}

export function computeCtaTiming(screenshot: Screenshot): CtaTimingResult {
  const { duration, zoom, clicks } = screenshot
  const zoomTime = zoom ? zoom.animateInDuration : 0
  const transitionBuffer = TRANSITION_DURATION
  const availableTime = duration - zoomTime - transitionBuffer

  if (availableTime <= 0) {
    return {
      windows: [],
      canAddMore: false,
      warning: 'Duration too short for any CTAs with current zoom settings',
    }
  }

  const maxCtas = Math.floor(availableTime / CTA_ANIMATION_DURATION)
  const activeCtas = clicks.slice(0, maxCtas)

  if (activeCtas.length === 0) {
    return {
      windows: [],
      canAddMore: availableTime >= CTA_ANIMATION_DURATION,
      warning: null,
    }
  }

  // Space CTAs evenly across available time
  const spacing = availableTime / activeCtas.length
  const windows: CtaWindow[] = activeCtas.map((_, i) => {
    const start = zoomTime + i * spacing
    const end = start + CTA_ANIMATION_DURATION
    return { start, end }
  })

  const canAddMore = (activeCtas.length + 1) * CTA_ANIMATION_DURATION <= availableTime

  const warning =
    clicks.length > maxCtas
      ? `Only ${maxCtas} of ${clicks.length} CTAs fit in the available time`
      : null

  return { windows, canAddMore, warning }
}

export function computeTotalDuration(
  screenshots: Screenshot[],
  transitionDuration: number = TRANSITION_DURATION,
): number {
  if (screenshots.length === 0) return 0
  const sumDurations = screenshots.reduce((sum, s) => sum + s.duration, 0)
  const overlapCount = Math.max(0, screenshots.length - 1)
  return sumDurations - overlapCount * transitionDuration
}

export function computeMinDuration(screenshot: Screenshot): number {
  const zoomTime = screenshot.zoom ? screenshot.zoom.animateInDuration : 0
  const ctaTime = screenshot.clicks.length * CTA_ANIMATION_DURATION
  const buffer = TRANSITION_DURATION
  return Math.max(MIN_DURATION, zoomTime + ctaTime + buffer)
}

export function validateAndAdjust(screenshot: Screenshot): Screenshot {
  const minRequired = computeMinDuration(screenshot)
  let adjusted = { ...screenshot }

  if (adjusted.duration < minRequired) {
    if (minRequired <= MAX_DURATION) {
      // Auto-increase duration
      adjusted = { ...adjusted, duration: minRequired }
    } else {
      // Can't fit all CTAs — trim from the end
      const availableTime = MAX_DURATION - (adjusted.zoom?.animateInDuration ?? 0) - TRANSITION_DURATION
      const maxCtas = Math.max(0, Math.floor(availableTime / CTA_ANIMATION_DURATION))
      adjusted = {
        ...adjusted,
        duration: MAX_DURATION,
        clicks: adjusted.clicks.slice(0, maxCtas),
      }
    }
  }

  return adjusted
}
