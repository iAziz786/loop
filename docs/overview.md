# Loop — Product Demo Video Creator

Loop is a browser-based tool that turns a sequence of product screenshots into polished 30s–1m demo videos. No backend, no install — runs entirely in the browser using FFmpeg.wasm for video encoding.

## Core Workflow

1. Upload screenshots (drag-and-drop or file picker)
2. Configure per-screenshot settings (duration, zoom, click CTAs)
3. Preview the video in an animated Canvas-based player with audio
4. Click "Render" → FFmpeg.wasm produces an MP4 → browser downloads it

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 5 + Vite |
| Package manager | Bun |
| Video encoding | @ffmpeg/ffmpeg (FFmpeg.wasm) |
| Canvas rendering | HTML5 Canvas API |
| Styling | Tailwind CSS |
| Hosting | Any static host (requires COOP/COEP headers) |

## Out of Scope (v1)

- Text overlays / captions
- Custom cursor images
- Multiple transition types (only crossfade)
- Video input (only static screenshots)
- Cloud rendering / server-side processing
- User accounts or cloud storage
- Mobile-responsive UI (desktop-first)
