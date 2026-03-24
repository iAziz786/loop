# Features

## Screenshot Management

- **Upload:** PNG, JPG, WebP via drag-and-drop or file picker
- **Reorder:** Drag-and-drop in the timeline
- **Duration:** Default 3s, adjustable 1s–30s per screenshot
- **Aspect ratio:** Center-crop to fill 1920x1080. Warning badge when crop loss exceeds 50%
- **Image preprocessing:** Downscale to max 4K (3840x2160) on upload
- **No hard cap** on count; warning at 15+ screenshots for memory

## Zoom

- **Toggle:** Enable/disable per screenshot
- **Range:** 1.5x to 3x
- **Center:** Drag on canvas in Edit mode to set zoom target
- **Animation:** Smooth ease-in-out zoom during the first ~1s, then hold
- **Preview indicator:** Crosshair + zoom level label shown in Preview mode before zoom completes

## Click CTA Animations

- **Independent from zoom** — place CTAs at any point, regardless of zoom
- **Coordinate space:** Positions stored in full-image space (0–1 normalized). During zoom, CTAs transform to match the viewport; invisible if outside
- **Visual:** Cursor enters from bottom-right, moves to click point (ease-out), then circular ripple expands (Material Design style)
- **Multiple per screenshot:** Cursor moves sequentially between CTA points
- **Timing:** Start after zoom completes, each ~1.5s, must finish 0.5s before screenshot ends
- **Duration validation:** UI auto-adjusts duration or limits CTAs when they don't fit

## Transitions

- Simple crossfade, fixed 0.5s, overlapping (not additive)
- Bookend fades: 0.5s fade-in from black, 0.5s fade-out to black

## Background Music

- 2 bundled royalty-free tracks (chord tones with echo/reverb)
- Custom upload: MP3/WAV
- Loops if shorter than video, 2s fade-out at end
- Volume adjustable (0–100%), can be muted
- Plays during preview and included in rendered MP4

## Live Preview

- Canvas-based animated preview with all effects (zoom, CTAs, transitions, fades)
- Audio playback synced with canvas (drift correction if >0.3s)
- Play/pause, custom scrub bar with live drag preview
- Click thumbnail or use arrow keys to seek to any screenshot
- Space bar toggles playback from current position

## Edit Mode

- Toggle between Preview and Edit mode on the canvas
- **Zoom tool:** Drag on canvas to set zoom center (live feedback)
- **CTA tool:** Click to place CTA markers
- Overlays: zoom region highlighted with dark mask + dashed border, CTA markers with numbered circles + connector lines
- Overlays persist per-screenshot when switching between images

## Save/Load

- Export: JSON config with SHA-256 checksums (computed in Web Worker)
- Import: Upload JSON + image files, matched by filename then validated by checksum
- Missing files shown as empty slots with replacement prompt

## Video Rendering

- Canvas-based frame rendering (same engine as preview — pixel-identical output)
- Every frame rendered through canvas, then encoded by FFmpeg.wasm as H.264 MP4
- Audio mixed with looping, fade-out, and volume adjustment
- Progress bar with frame count, cancel support
- Fresh FFmpeg instance per render (avoids stale worker issues)
