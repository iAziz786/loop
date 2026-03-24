<script lang="ts">
  import type { Screenshot } from '../lib/types'
  import { removeClick } from '../lib/state.svelte'
  import { computeCtaTiming } from '../lib/timing'

  interface Props {
    screenshot: Screenshot
  }

  let { screenshot }: Props = $props()

  const ctaTiming = $derived(computeCtaTiming(screenshot))
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <span class="text-sm font-medium text-gray-300">Click CTAs</span>
    <span class="text-xs text-gray-500">{screenshot.clicks.length} click{screenshot.clicks.length !== 1 ? 's' : ''}</span>
  </div>

  {#if ctaTiming.warning}
    <p class="rounded bg-yellow-900/50 px-2 py-1 text-xs text-yellow-300">{ctaTiming.warning}</p>
  {/if}

  {#if screenshot.clicks.length === 0}
    <p class="text-xs text-gray-500">Click on canvas in Edit mode to add click points</p>
  {:else}
    <div class="space-y-1">
      {#each screenshot.clicks as click, i}
        <div class="flex items-center justify-between rounded bg-gray-800 px-2 py-1">
          <span class="font-mono text-xs text-gray-400">
            ({click.x.toFixed(2)}, {click.y.toFixed(2)})
          </span>
          <button
            class="text-xs text-red-400 hover:text-red-300"
            onclick={() => removeClick(screenshot.id, i)}
          >remove</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if !ctaTiming.canAddMore && screenshot.clicks.length > 0}
    <p class="text-xs text-gray-500">Increase duration to add more CTAs</p>
  {/if}
</div>
