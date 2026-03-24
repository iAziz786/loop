<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { projectState, addClick, setZoom, selectScreenshot } from '../lib/state.svelte'
  import { OUTPUT_WIDTH, OUTPUT_HEIGHT } from '../lib/constants'
  import { loadImage } from '../lib/image'
  import { PlaybackController } from '../engine/playback.svelte'
  import { computeFrameState } from '../engine/transition'
  import { renderEditFrame } from '../engine/edit-renderer'

  let canvas: HTMLCanvasElement
  let controller: PlaybackController | null = null
  let images: HTMLImageElement[] = $state([])
  let editMode = $state(false)
  let editTool: 'zoom' | 'cta' = $state('cta')
  let zoomDragPointerId: number | null = $state(null)

  // Export controller state for PlaybackControls
  export function getController(): PlaybackController | null {
    return controller
  }

  async function loadAllImages() {
    const newImages: HTMLImageElement[] = []
    for (const s of projectState.project.screenshots) {
      if (s.file) {
        const url = URL.createObjectURL(s.file)
        try {
          newImages.push(await loadImage(url))
        } catch {
          const blank = new Image()
          newImages.push(blank)
        }
      }
    }
    images = newImages
  }

  // Reactively reload images when screenshots change
  let lastScreenshotIds = ''
  $effect(() => {
    const ids = projectState.project.screenshots.map((s) => s.id).join(',')
    if (ids !== lastScreenshotIds) {
      lastScreenshotIds = ids
      loadAllImages().then(() => {
        if (controller) {
          controller.updateProject(projectState.project, images)
        }
      })
    }
  })

  // Update controller when project settings change (but not screenshot list)
  $effect(() => {
    if (controller && images.length > 0) {
      const _ = projectState.project.screenshots.map((s) => ({
        duration: s.duration,
        zoom: s.zoom,
        clicks: s.clicks,
      }))
      controller.updateProject(projectState.project, images)
    }
  })

  // Edit mode: render the selected screenshot with zoom/CTA overlays
  $effect(() => {
    if (!editMode || !canvas || images.length === 0) return
    const screenshot = projectState.selectedScreenshot
    if (!screenshot) return

    // Access reactive properties to trigger re-render on changes
    const _zoom = screenshot.zoom
    const _clicks = screenshot.clicks
    const _id = screenshot.id

    const index = projectState.project.screenshots.findIndex((s) => s.id === screenshot.id)
    const img = images[index]
    if (!img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    renderEditFrame(ctx, screenshot, img)
  })

  // Watch for seek requests from thumbnail clicks / arrow keys
  let lastSeekCounter = 0
  $effect(() => {
    const req = projectState.seekRequest
    if (req.counter !== lastSeekCounter && controller) {
      lastSeekCounter = req.counter
      controller.seek(req.time)

      // If in edit mode, also re-render (the edit effect above will handle it
      // since selectedScreenshotId changes trigger it)
    }
  })

  onMount(() => {
    const ctx = canvas.getContext('2d')!
    controller = new PlaybackController(ctx, projectState.project, images)
    loadAllImages().then(() => {
      controller!.updateProject(projectState.project, images)
    })

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)
  })

  onDestroy(() => {
    controller?.destroy()
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerUp)
    window.removeEventListener('pointercancel', handleWindowPointerUp)
  })

  function getCanvasPoint(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }

  function updateZoomCenterAt(clientX: number, clientY: number) {
    if (!editMode || editTool !== 'zoom') return
    const screenshot = projectState.selectedScreenshot
    if (!screenshot?.zoom) return

    const point = getCanvasPoint(clientX, clientY)
    if (!point) return

    setZoom(screenshot.id, { ...screenshot.zoom, centerX: point.x, centerY: point.y })
  }

  function handleCanvasPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (!editMode || editTool !== 'zoom') return

    const screenshot = projectState.selectedScreenshot
    if (!screenshot?.zoom) return

    zoomDragPointerId = e.pointerId
    updateZoomCenterAt(e.clientX, e.clientY)
  }

  function handleWindowPointerMove(e: PointerEvent) {
    if (zoomDragPointerId !== e.pointerId) return
    updateZoomCenterAt(e.clientX, e.clientY)
  }

  function handleWindowPointerUp(e: PointerEvent) {
    if (zoomDragPointerId !== e.pointerId) return
    updateZoomCenterAt(e.clientX, e.clientY)
    zoomDragPointerId = null
  }

  function handleCanvasClick(e: MouseEvent) {
    if (!editMode || editTool !== 'cta') return
    const screenshot = projectState.selectedScreenshot
    if (!screenshot) return

    const point = getCanvasPoint(e.clientX, e.clientY)
    if (!point) return

    addClick(screenshot.id, point)
  }
</script>

<div class="relative flex flex-1 flex-col">
  <!-- Mode toggle -->
  <div class="absolute top-2 left-2 z-10 flex gap-1 rounded bg-black/60 p-1">
    <button
      class="rounded px-2 py-1 text-xs {!editMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}"
      onclick={() => editMode = false}
    >Preview</button>
    <button
      class="rounded px-2 py-1 text-xs {editMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}"
      onclick={() => { editMode = true; controller?.pause() }}
    >Edit</button>
  </div>

  {#if editMode}
    <div class="absolute top-2 right-2 z-10 flex gap-1 rounded bg-black/60 p-1">
      <button
        class="rounded px-2 py-1 text-xs {editTool === 'zoom' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}"
        onclick={() => editTool = 'zoom'}
      >Zoom Center</button>
      <button
        class="rounded px-2 py-1 text-xs {editTool === 'cta' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}"
        onclick={() => editTool = 'cta'}
      >Add Click</button>
    </div>
  {/if}

  <!-- Canvas -->
  <div class="flex flex-1 items-center justify-center bg-black">
    <canvas
      bind:this={canvas}
      width={OUTPUT_WIDTH}
      height={OUTPUT_HEIGHT}
      class="max-h-full max-w-full {editMode ? (editTool === 'zoom' ? (zoomDragPointerId === null ? 'cursor-grab' : 'cursor-grabbing') : 'cursor-crosshair') : 'cursor-default'}"
      style="aspect-ratio: {OUTPUT_WIDTH}/{OUTPUT_HEIGHT}; touch-action: none;"
      onclick={handleCanvasClick}
      onpointerdown={handleCanvasPointerDown}
    ></canvas>
  </div>
</div>
