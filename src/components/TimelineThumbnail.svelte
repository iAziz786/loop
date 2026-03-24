<script lang="ts">
  import type { Screenshot } from '../lib/types'
  import { selectAndSeekToScreenshot, removeScreenshot, getCropWarning } from '../lib/state.svelte'

  interface Props {
    screenshot: Screenshot
    isSelected: boolean
  }

  let { screenshot, isSelected }: Props = $props()

  const hasCropWarning = $derived(getCropWarning(screenshot))
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="group relative flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors
    {isSelected ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'}"
  onclick={() => selectAndSeekToScreenshot(screenshot.id)}
  onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') selectAndSeekToScreenshot(screenshot.id) }}
  role="button"
  tabindex="0"
>
  <img
    src={screenshot.thumbnailUrl}
    alt={screenshot.filename}
    class="h-16 w-24 object-cover"
  />

  <!-- Duration badge -->
  <span class="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
    {screenshot.duration}s
  </span>

  <!-- Crop warning -->
  {#if hasCropWarning}
    <span
      class="absolute top-1 left-1 rounded bg-yellow-600/80 px-1 py-0.5 text-xs text-white"
      title="More than 50% of this image will be cropped"
    >!</span>
  {/if}

  <!-- Zoom indicator -->
  {#if screenshot.zoom}
    <span class="absolute top-1 right-1 rounded bg-blue-600/80 px-1 py-0.5 text-xs text-white">Z</span>
  {/if}

  <!-- CTA count -->
  {#if screenshot.clicks.length > 0}
    <span class="absolute bottom-1 right-1 rounded bg-purple-600/80 px-1 py-0.5 text-xs text-white">
      {screenshot.clicks.length}
    </span>
  {/if}

  <!-- Delete button -->
  <button
    class="absolute top-0 right-0 hidden rounded-bl bg-red-600/80 px-1.5 py-0.5 text-xs text-white group-hover:block"
    onclick={(e: MouseEvent) => { e.stopPropagation(); removeScreenshot(screenshot.id) }}
    aria-label="Remove screenshot"
  >x</button>
</div>
