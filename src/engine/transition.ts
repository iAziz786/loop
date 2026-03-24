import type { Screenshot } from '../lib/types'

export interface FrameState {
  screenshotIndex: number
  localTime: number
  alpha: number
  nextIndex: number | null
  crossfadeProgress: number | null
  bookendFadeAlpha: number // 1 = fully visible, 0 = black
}

/**
 * Compute the start time of each screenshot in the global timeline.
 * Screenshots overlap by transitionDuration seconds.
 */
export function computeStartTimes(
  screenshots: Screenshot[],
  transitionDuration: number,
): number[] {
  const starts: number[] = []
  let t = 0
  for (let i = 0; i < screenshots.length; i++) {
    starts.push(t)
    t += screenshots[i].duration - transitionDuration
  }
  return starts
}

export function computeTotalDuration(
  screenshots: Screenshot[],
  transitionDuration: number,
): number {
  if (screenshots.length === 0) return 0
  const starts = computeStartTimes(screenshots, transitionDuration)
  const last = screenshots.length - 1
  return starts[last] + screenshots[last].duration
}

/**
 * Given a global time, resolve which screenshot(s) are visible and their alpha values.
 */
export function computeFrameState(
  globalTime: number,
  screenshots: Screenshot[],
  transitionDuration: number,
  bookendFadeDuration: number,
): FrameState {
  if (screenshots.length === 0) {
    return {
      screenshotIndex: 0,
      localTime: 0,
      alpha: 0,
      nextIndex: null,
      crossfadeProgress: null,
      bookendFadeAlpha: 0,
    }
  }

  const starts = computeStartTimes(screenshots, transitionDuration)
  const totalDuration = starts[starts.length - 1] + screenshots[screenshots.length - 1].duration
  const clampedTime = Math.max(0, Math.min(globalTime, totalDuration))

  // Find which screenshot we're on
  let currentIndex = 0
  for (let i = screenshots.length - 1; i >= 0; i--) {
    if (clampedTime >= starts[i]) {
      currentIndex = i
      break
    }
  }

  const localTime = clampedTime - starts[currentIndex]
  const currentDuration = screenshots[currentIndex].duration

  // Crossfade detection
  let nextIndex: number | null = null
  let crossfadeProgress: number | null = null

  if (currentIndex < screenshots.length - 1) {
    const overlapStart = currentDuration - transitionDuration
    if (localTime >= overlapStart) {
      nextIndex = currentIndex + 1
      crossfadeProgress = (localTime - overlapStart) / transitionDuration
    }
  }

  // Alpha for current screenshot (1.0 normally, fading out during crossfade)
  const alpha = crossfadeProgress !== null ? 1 - crossfadeProgress : 1

  // Bookend fades
  let bookendFadeAlpha = 1
  if (clampedTime < bookendFadeDuration) {
    bookendFadeAlpha = clampedTime / bookendFadeDuration
  } else if (clampedTime > totalDuration - bookendFadeDuration) {
    bookendFadeAlpha = (totalDuration - clampedTime) / bookendFadeDuration
  }

  return {
    screenshotIndex: currentIndex,
    localTime,
    alpha,
    nextIndex,
    crossfadeProgress,
    bookendFadeAlpha,
  }
}
