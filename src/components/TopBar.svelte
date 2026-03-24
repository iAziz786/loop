<script lang="ts">
  import { projectState } from '../lib/state.svelte'
</script>

<header class="flex items-center justify-between border-b border-gray-800 px-6 py-3">
  <h1 class="text-xl font-bold tracking-tight text-white">Loop</h1>
  <div class="flex items-center gap-4 text-sm text-gray-400">
    <span>{projectState.screenshotCount} screenshot{projectState.screenshotCount !== 1 ? 's' : ''}</span>
    <span class="text-gray-600">|</span>
    <span>{projectState.totalDuration.toFixed(1)}s</span>
  </div>
</header>
