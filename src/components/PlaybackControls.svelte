<script lang="ts">
  import { onMount } from 'svelte'
  import { projectState, selectScreenshot } from '../lib/state.svelte'
  import { computeFrameState } from '../engine/transition'
  import type { PlaybackController } from '../engine/playback.svelte'

  interface Props {
    controller: PlaybackController | null
  }

  let { controller }: Props = $props()

  const totalDuration = $derived(projectState.totalDuration)

  let trackEl: HTMLDivElement
  let isDragging = $state(false)
  let dragTime = $state(0)

  const displayTime = $derived(isDragging ? dragTime : (controller?.currentTime ?? 0))
  const progressPct = $derived(totalDuration > 0 ? (displayTime / totalDuration) * 100 : 0)

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function timeFromPointer(e: PointerEvent | MouseEvent): number {
    const rect = trackEl.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return pct * totalDuration
  }

  function seekToTime(time: number) {
    controller?.seek(time)
    const frame = computeFrameState(
      time,
      projectState.project.screenshots,
      projectState.project.transitionDuration,
      projectState.project.bookendFadeDuration,
    )
    const screenshot = projectState.project.screenshots[frame.screenshotIndex]
    if (screenshot) selectScreenshot(screenshot.id)
  }

  function handlePointerDown(e: PointerEvent) {
    isDragging = true
    controller?.pause()
    try { trackEl.setPointerCapture(e.pointerId) } catch {}
    const time = timeFromPointer(e)
    dragTime = time
    seekToTime(time)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return
    const time = timeFromPointer(e)
    dragTime = time
    seekToTime(time)
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isDragging) return
    isDragging = false
    try { trackEl.releasePointerCapture(e.pointerId) } catch {}
  }
</script>

<div class="flex items-center gap-3 border-t border-gray-800 bg-gray-900/50 px-4 py-2">
  <button
    class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
    onclick={() => controller?.toggle()}
    aria-label={controller?.isPlaying ? 'Pause' : 'Play'}
  >
    {#if controller?.isPlaying}
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
      </svg>
    {:else}
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    {/if}
  </button>

  <!-- Custom scrub bar: div-based, tracks pointer directly -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={trackEl}
    class="relative flex-1 cursor-pointer select-none py-2"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onclick={handleClick}
    role="slider"
    aria-valuemin={0}
    aria-valuemax={totalDuration}
    aria-valuenow={displayTime}
    tabindex="0"
  >
    <!-- Track background -->
    <div class="h-1.5 w-full rounded-full bg-gray-700">
      <!-- Progress fill -->
      <div
        class="h-full rounded-full bg-blue-500 transition-none"
        style="width: {progressPct}%"
      ></div>
    </div>
    <!-- Thumb -->
    <div
      class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 shadow {isDragging ? 'scale-125' : 'hover:scale-110'} transition-transform"
      style="left: {progressPct}%"
    ></div>
  </div>

  <span class="min-w-[5rem] flex-shrink-0 text-right font-mono text-xs text-gray-500">
    {formatTime(displayTime)} / {formatTime(totalDuration)}
  </span>
</div>
