<script lang="ts">
  import { projectState } from '../lib/state.svelte'
  import { loadImage } from '../lib/image'
  import { renderVideo, type RenderProgress } from '../render/render-pipeline'
  import { checkSharedArrayBuffer } from '../render/ffmpeg-manager'

  interface Props {
    onClose: () => void
  }

  let { onClose }: Props = $props()

  let progress = $state<RenderProgress>({ stage: 'loading', percent: 0, message: 'Ready to render' })
  let isRendering = $state(false)
  let downloadUrl = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)
  let abortController: AbortController | null = null

  const hasSharedArrayBuffer = checkSharedArrayBuffer()

  async function startRender() {
    isRendering = true
    errorMessage = null
    downloadUrl = null
    abortController = new AbortController()

    try {
      // Load images
      const images: HTMLImageElement[] = []
      for (const s of projectState.project.screenshots) {
        if (s.file) {
          const url = URL.createObjectURL(s.file)
          images.push(await loadImage(url))
        }
      }

      const blob = await renderVideo(
        projectState.project,
        images,
        (p) => { progress = p },
        abortController.signal,
      )

      downloadUrl = URL.createObjectURL(blob)
      progress = { stage: 'done', percent: 100, message: 'Video ready!' }
    } catch (err: any) {
      if (err.message === 'Cancelled') {
        progress = { stage: 'error', percent: 0, message: 'Cancelled' }
      } else {
        errorMessage = err.message || 'Unknown error'
        progress = { stage: 'error', percent: 0, message: 'Render failed' }
      }
    } finally {
      isRendering = false
    }
  }

  function cancelRender() {
    abortController?.abort()
  }

  function handleDownload() {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = 'loop-demo.mp4'
    a.click()
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !isRendering) onClose()
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
  onclick={handleBackdropClick}
  role="dialog"
  aria-modal="true"
>
  <div class="w-[28rem] rounded-xl bg-gray-900 p-6 shadow-2xl">
    <h2 class="mb-4 text-lg font-semibold text-white">Render Video</h2>

    {#if !hasSharedArrayBuffer}
      <div class="rounded-lg bg-red-900/50 p-4 text-sm text-red-300">
        <p class="font-medium">SharedArrayBuffer not available</p>
        <p class="mt-1 text-xs text-red-400">
          Your server needs to send these headers:<br />
          Cross-Origin-Opener-Policy: same-origin<br />
          Cross-Origin-Embedder-Policy: require-corp
        </p>
      </div>
    {:else if downloadUrl}
      <!-- Success -->
      <div class="space-y-4">
        <div class="rounded-lg bg-green-900/30 p-4 text-center">
          <p class="text-green-300">Video rendered successfully!</p>
        </div>
        <button
          class="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500"
          onclick={handleDownload}
        >Download MP4</button>
      </div>
    {:else if errorMessage}
      <!-- Error -->
      <div class="space-y-4">
        <div class="rounded-lg bg-red-900/30 p-4">
          <p class="text-sm text-red-300">{errorMessage}</p>
        </div>
        <button
          class="w-full rounded-lg bg-gray-700 py-2 text-sm text-gray-300 hover:bg-gray-600"
          onclick={startRender}
        >Retry</button>
      </div>
    {:else}
      <!-- Ready or rendering -->
      <div class="space-y-4">
        <div>
          <div class="mb-1 flex justify-between text-xs text-gray-400">
            <span>{progress.message}</span>
            <span>{Math.round(progress.percent)}%</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              class="h-full rounded-full bg-blue-500 transition-all duration-300"
              style="width: {progress.percent}%"
            ></div>
          </div>
        </div>

        {#if isRendering}
          <button
            class="w-full rounded-lg bg-red-700 py-2 text-sm text-white hover:bg-red-600"
            onclick={cancelRender}
          >Cancel</button>
        {:else}
          <button
            class="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500"
            onclick={startRender}
          >Start Rendering</button>
        {/if}
      </div>
    {/if}

    {#if !isRendering}
      <button
        class="mt-3 w-full rounded-lg bg-gray-800 py-2 text-sm text-gray-400 hover:bg-gray-700"
        onclick={onClose}
      >Close</button>
    {/if}
  </div>
</div>
