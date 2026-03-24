<script lang="ts">
  import { projectState, updateScreenshot } from '../lib/state.svelte'
  import { MIN_DURATION, MAX_DURATION } from '../lib/constants'
  import ZoomSettings from './ZoomSettings.svelte'
  import CtaSettings from './CtaSettings.svelte'
  import MusicSettings from './MusicSettings.svelte'

  const screenshot = $derived(projectState.selectedScreenshot)

  function handleDurationChange(e: Event) {
    if (!screenshot) return
    const value = parseFloat((e.target as HTMLInputElement).value)
    updateScreenshot(screenshot.id, { duration: value })
  }
</script>

<aside class="flex w-64 flex-shrink-0 flex-col gap-4 overflow-y-auto border-l border-gray-800 bg-gray-900/30 p-4">
  {#if screenshot}
    <div class="space-y-1">
      <h3 class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
        {screenshot.filename}
      </h3>
      <p class="text-xs text-gray-600">
        {screenshot.originalWidth} x {screenshot.originalHeight}
      </p>
    </div>

    <!-- Duration -->
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-300">Duration</span>
        <span class="font-mono text-sm text-gray-400">{screenshot.duration}s</span>
      </div>
      <input
        type="range"
        min={MIN_DURATION}
        max={MAX_DURATION}
        step="0.5"
        value={screenshot.duration}
        oninput={handleDurationChange}
        class="w-full accent-blue-500"
      />
    </div>

    <hr class="border-gray-800" />
    <ZoomSettings {screenshot} />

    <hr class="border-gray-800" />
    <CtaSettings {screenshot} />

    <hr class="border-gray-800" />
    <MusicSettings />
  {:else}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-sm text-gray-600">Select a screenshot to edit</p>
    </div>
  {/if}
</aside>
