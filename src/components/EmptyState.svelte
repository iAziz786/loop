<script lang="ts">
  import { addScreenshot } from '../lib/state.svelte'

  let dragOver = $state(false)
  let fileInput: HTMLInputElement

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    const files = e.dataTransfer?.files
    if (files) processFiles(files)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragOver = true
  }

  function handleDragLeave() {
    dragOver = false
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) processFiles(input.files)
    input.value = ''
  }

  async function processFiles(files: FileList) {
    const imageFiles = Array.from(files).filter((f) =>
      ['image/png', 'image/jpeg', 'image/webp'].includes(f.type),
    )
    for (const file of imageFiles) {
      await addScreenshot(file)
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="flex flex-1 items-center justify-center"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
>
  <button
    class="flex h-64 w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors
      {dragOver ? 'border-blue-400 bg-blue-950/30' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900/50'}"
    onclick={() => fileInput.click()}
  >
    <svg class="mb-4 h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    <p class="text-lg text-gray-400">Drop screenshots here or click to upload</p>
    <p class="mt-1 text-sm text-gray-600">PNG, JPG, WebP</p>
  </button>
  <input
    bind:this={fileInput}
    type="file"
    multiple
    accept="image/png,image/jpeg,image/webp"
    class="hidden"
    onchange={handleFileSelect}
  />
</div>
