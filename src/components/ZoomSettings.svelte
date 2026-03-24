<script lang="ts">
  import type { Screenshot } from '../lib/types'
  import { setZoom } from '../lib/state.svelte'
  import { ZOOM_MIN, ZOOM_MAX, ZOOM_ANIMATE_IN_DURATION } from '../lib/constants'

  interface Props {
    screenshot: Screenshot
  }

  let { screenshot }: Props = $props()

  const zoomEnabled = $derived(screenshot.zoom !== null)

  function toggleZoom() {
    if (screenshot.zoom) {
      setZoom(screenshot.id, null)
    } else {
      setZoom(screenshot.id, {
        centerX: 0.5,
        centerY: 0.5,
        level: 2.0,
        animateInDuration: ZOOM_ANIMATE_IN_DURATION,
      })
    }
  }

  function updateLevel(e: Event) {
    if (!screenshot.zoom) return
    const value = parseFloat((e.target as HTMLInputElement).value)
    setZoom(screenshot.id, { ...screenshot.zoom, level: value })
  }
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <span class="text-sm font-medium text-gray-300">Zoom</span>
    <button
      class="rounded px-2 py-1 text-xs transition-colors
        {zoomEnabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}"
      onclick={toggleZoom}
    >
      {zoomEnabled ? 'Enabled' : 'Disabled'}
    </button>
  </div>

  {#if screenshot.zoom}
    <div class="space-y-1">
      <div class="flex items-center justify-between text-xs text-gray-400">
        <span>{ZOOM_MIN}x</span>
        <span class="font-mono text-gray-300">{screenshot.zoom.level.toFixed(1)}x</span>
        <span>{ZOOM_MAX}x</span>
      </div>
      <input
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step="0.1"
        value={screenshot.zoom.level}
        oninput={updateLevel}
        class="w-full accent-blue-500"
      />
      <p class="text-xs text-gray-500">
        Center: ({screenshot.zoom.centerX.toFixed(2)}, {screenshot.zoom.centerY.toFixed(2)})
        — drag on canvas in Edit mode to set
      </p>
    </div>
  {/if}
</div>
