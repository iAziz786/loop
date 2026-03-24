<script lang="ts">
  import { projectState, addScreenshot, reorderScreenshots } from '../lib/state.svelte'
  import TimelineThumbnail from './TimelineThumbnail.svelte'

  let fileInput: HTMLInputElement

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) {
      const files = Array.from(input.files).filter((f) =>
        ['image/png', 'image/jpeg', 'image/webp'].includes(f.type),
      )
      files.forEach((f) => addScreenshot(f))
    }
    input.value = ''
  }

  let dragFromIndex: number | null = null

  function handleDragStart(index: number) {
    dragFromIndex = index
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: DragEvent, toIndex: number) {
    e.preventDefault()
    if (dragFromIndex !== null && dragFromIndex !== toIndex) {
      reorderScreenshots(dragFromIndex, toIndex)
    }
    dragFromIndex = null
  }
</script>

<div class="border-t border-gray-800 bg-gray-900/50 px-4 py-3">
  {#if projectState.memoryWarning}
    <div class="mb-2 rounded bg-yellow-900/50 px-3 py-1.5 text-xs text-yellow-300">
      {projectState.screenshotCount} screenshots loaded — high memory usage may cause issues
    </div>
  {/if}

  <div class="flex items-center gap-2 overflow-x-auto pb-1">
    {#each projectState.project.screenshots as screenshot, index (screenshot.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        draggable="true"
        ondragstart={() => handleDragStart(index)}
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, index)}
      >
        <TimelineThumbnail
          {screenshot}
          isSelected={screenshot.id === projectState.selectedScreenshotId}
        />
      </div>
    {/each}

    <!-- Add button -->
    <button
      class="flex h-16 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-700 text-gray-500 transition-colors hover:border-gray-500 hover:text-gray-300"
      onclick={() => fileInput.click()}
      aria-label="Add screenshot"
    >
      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    multiple
    accept="image/png,image/jpeg,image/webp"
    class="hidden"
    onchange={handleFileSelect}
  />
</div>
