<script lang="ts">
  import { projectState, setMusic } from '../lib/state.svelte'
  import { BUNDLED_TRACKS } from '../lib/constants'

  let fileInput: HTMLInputElement

  function handleTrackSelect(index: number) {
    setMusic({ source: 'default', trackIndex: index, customFile: null })
  }

  function handleCustomUpload(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      if (!['audio/mpeg', 'audio/wav', 'audio/mp3'].includes(file.type)) {
        // Will be handled by toast in parent
        return
      }
      setMusic({ source: 'custom', customFile: file })
    }
    input.value = ''
  }

  function handleVolumeChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value)
    setMusic({ volume: value })
  }
</script>

<div class="space-y-3">
  <span class="text-sm font-medium text-gray-300">Background Music</span>

  <div class="space-y-1.5">
    {#each BUNDLED_TRACKS as track, i}
      <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-800">
        <input
          type="radio"
          name="music-track"
          checked={projectState.project.music.source === 'default' && projectState.project.music.trackIndex === i}
          onchange={() => handleTrackSelect(i)}
          class="accent-blue-500"
        />
        <span class="text-xs text-gray-300">{track.name}</span>
      </label>
    {/each}
    <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-800">
      <input
        type="radio"
        name="music-track"
        checked={projectState.project.music.source === 'custom'}
        onchange={() => fileInput.click()}
        class="accent-blue-500"
      />
      <span class="text-xs text-gray-300">
        {#if projectState.project.music.source === 'custom' && projectState.project.music.customFile}
          {projectState.project.music.customFile.name}
        {:else}
          Custom audio...
        {/if}
      </span>
    </label>
  </div>

  <div class="space-y-1">
    <div class="flex items-center justify-between text-xs text-gray-400">
      <span>Volume</span>
      <span class="font-mono">{Math.round(projectState.project.music.volume * 100)}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={projectState.project.music.volume}
      oninput={handleVolumeChange}
      class="w-full accent-blue-500"
    />
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept="audio/mpeg,audio/wav,audio/mp3"
    class="hidden"
    onchange={handleCustomUpload}
  />
</div>
