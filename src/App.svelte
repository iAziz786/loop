<script lang="ts">
  import { projectState, setProjectFromImport, selectAndSeekToScreenshot } from './lib/state.svelte'
  import { downloadConfig, importConfig } from './lib/config-io'
  import TopBar from './components/TopBar.svelte'
  import EmptyState from './components/EmptyState.svelte'
  import PreviewCanvas from './components/PreviewCanvas.svelte'
  import PlaybackControls from './components/PlaybackControls.svelte'
  import SettingsPanel from './components/SettingsPanel.svelte'
  import Timeline from './components/Timeline.svelte'
  import RenderDialog from './components/RenderDialog.svelte'

  let showRenderDialog = $state(false)
  let previewCanvas = $state<PreviewCanvas>(null!)
  let configInput: HTMLInputElement
  let imageInput: HTMLInputElement
  let pendingConfigJson = $state<string | null>(null)

  const hasScreenshots = $derived(projectState.screenshotCount > 0)
  const controller = $derived(previewCanvas?.getController() ?? null)

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.code === 'Space') {
      e.preventDefault()
      controller?.toggle()
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault()
      navigateScreenshot(-1)
    } else if (e.code === 'ArrowRight') {
      e.preventDefault()
      navigateScreenshot(1)
    }
  }

  function navigateScreenshot(direction: number) {
    const screenshots = projectState.project.screenshots
    if (screenshots.length === 0) return
    const currentIdx = screenshots.findIndex((s) => s.id === projectState.selectedScreenshotId)
    const newIdx = Math.max(0, Math.min(screenshots.length - 1, currentIdx + direction))
    selectAndSeekToScreenshot(screenshots[newIdx].id)
  }

  function handleExport() {
    downloadConfig(projectState.project)
  }

  function handleImportConfig(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      pendingConfigJson = reader.result as string
      imageInput.click()
    }
    reader.readAsText(file)
    ;(e.target as HTMLInputElement).value = ''
  }

  async function handleImportImages(e: Event) {
    const files = (e.target as HTMLInputElement).files
    if (!files || !pendingConfigJson) return
    try {
      const project = await importConfig(pendingConfigJson, Array.from(files))
      setProjectFromImport(project)
    } catch (err) {
      console.error('Import failed:', err)
    }
    pendingConfigJson = null
    ;(e.target as HTMLInputElement).value = ''
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen flex-col bg-gray-950 text-gray-100">
  <TopBar />

  {#if !hasScreenshots}
    <EmptyState />
  {:else}
    <!-- Main content area -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Preview + controls -->
      <div class="flex flex-1 flex-col">
        <PreviewCanvas bind:this={previewCanvas} />
        <PlaybackControls {controller} />
      </div>

      <!-- Settings panel -->
      <SettingsPanel />
    </div>

    <!-- Timeline -->
    <Timeline />

    <!-- Footer actions -->
    <div class="flex items-center justify-between border-t border-gray-800 px-4 py-2">
      <div class="flex gap-2">
        <button
          class="rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          onclick={handleExport}
        >
          Export Config
        </button>
        <button
          class="rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          onclick={() => configInput.click()}
        >
          Import Config
        </button>
      </div>
      <button
        class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        onclick={() => (showRenderDialog = true)}
      >
        Render MP4
      </button>
    </div>
  {/if}

  {#if showRenderDialog}
    <RenderDialog onClose={() => (showRenderDialog = false)} />
  {/if}

  <!-- Hidden file inputs for import -->
  <input bind:this={configInput} type="file" accept=".json" class="hidden" onchange={handleImportConfig} />
  <input bind:this={imageInput} type="file" multiple accept="image/png,image/jpeg,image/webp" class="hidden" onchange={handleImportImages} />
</div>
