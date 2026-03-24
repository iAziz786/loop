# Architecture

## Fully Client-Side

No server component. All processing happens in the user's browser. The app is a static site hostable on GitHub Pages, Netlify, Vercel, etc.

**Output:** MP4 (H.264), 1920x1080 (1080p), 30fps

## Project Structure

```
src/
  main.ts                        # Svelte mount point
  App.svelte                     # Top-level layout, keyboard shortcuts
  app.css                        # Tailwind directives

  lib/
    types.ts                     # Project, Screenshot, ZoomConfig, ClickCTA, MusicConfig
    state.svelte.ts              # Svelte 5 runes store (central project state)
    constants.ts                 # OUTPUT_WIDTH, FRAMERATE, defaults
    image.ts                     # Downscale, center-crop math, crop-loss calculation
    checksum.worker.ts           # Web Worker for SHA-256 computation
    checksum.ts                  # Promise wrapper around the worker
    timing.ts                    # Total duration, CTA timing windows, validation
    config-io.ts                 # JSON export/import with checksum matching

  components/
    EmptyState.svelte            # Drop-zone landing page
    TopBar.svelte                # Header / branding
    Timeline.svelte              # Horizontal thumbnail strip + drag reorder
    TimelineThumbnail.svelte     # Single thumbnail card with badges
    SettingsPanel.svelte         # Right sidebar: duration, zoom, CTAs, music
    ZoomSettings.svelte          # Zoom toggle, slider, center preview
    CtaSettings.svelte           # CTA list, add/remove, timing warnings
    MusicSettings.svelte         # Track picker, volume, custom upload
    PreviewCanvas.svelte         # Main canvas + mode switching + zoom drag
    PlaybackControls.svelte      # Custom div-based scrub bar + play/pause
    RenderDialog.svelte          # Modal: progress bar, cancel, download
    Toast.svelte                 # Transient notifications

  engine/
    canvas-renderer.ts           # Draws a single frame given project state + time
    playback.svelte.ts           # requestAnimationFrame loop + audio sync
    cta-animator.ts              # Cursor path + ripple math
    zoom-animator.ts             # Zoom viewport calculation + coordinate transform
    transition.ts                # Crossfade + bookend fade timeline resolver
    edit-renderer.ts             # Edit mode overlays (zoom region, CTA markers)

  render/
    ffmpeg-manager.ts            # Load/terminate FFmpeg.wasm (fresh instance per render)
    render-pipeline.ts           # Canvas frame-by-frame rendering → FFmpeg encoding
```

## Rendering Pipeline

The render pipeline uses the **same canvas renderer** as the preview. This guarantees pixel-identical output:

1. **Frame rendering** — Loop through every frame at 30fps, call `renderFrame()` for each (zoom, CTAs, transitions, fades all included)
2. **Frame export** — Each frame exported as JPEG, written to FFmpeg's virtual filesystem
3. **FFmpeg encoding** — Reads image sequence + audio, encodes to H.264 MP4
4. **Audio mixing** — FFmpeg handles looping, fade-out, and volume

## Key Design Decisions

- **Canvas-based rendering for both preview and export** — avoids the complexity of maintaining two separate rendering pipelines (Canvas for preview, FFmpeg filters for export)
- **Fresh FFmpeg instance per render** — FFmpeg.wasm's worker terminates after `exec()`, so reusing instances causes hangs
- **Custom scrub bar** — Native `<input type="range">` had issues with Svelte reactivity fighting the drag. Custom div-based slider tracks pointer position directly
- **Coordinate transform for zoomed CTAs** — `canvasToViewport()` maps CTA positions from full-image space through the current zoom viewport so clicks appear at the correct spot
