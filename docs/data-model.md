# Data Model

## TypeScript Interfaces

```typescript
interface Project {
  version: 1
  screenshots: Screenshot[]
  music: MusicConfig
  outputResolution: { width: 1920; height: 1080 }
  framerate: 30
  transitionDuration: 0.5
  bookendFadeDuration: 0.5
}

interface Screenshot {
  id: string
  file: File | null           // in-memory reference (not serialized)
  filename: string            // original filename
  checksum: string            // SHA-256 for config matching
  duration: number            // seconds, default 3, min 1, max 30
  zoom: ZoomConfig | null
  clicks: ClickCTA[]
  thumbnailUrl: string        // data URL for timeline
  originalWidth: number
  originalHeight: number
  // order = array position in Project.screenshots
  // cropWarning = computed at runtime from dimensions
}

interface ZoomConfig {
  centerX: number             // 0-1 normalized on the original image
  centerY: number             // 0-1 normalized on the original image
  level: number               // 1.5 to 3.0
  animateInDuration: number   // ~1 second
}

interface ClickCTA {
  x: number                   // 0-1 normalized in full-canvas space
  y: number                   // 0-1 normalized in full-canvas space
}

interface MusicConfig {
  source: 'default' | 'custom'
  trackIndex: number          // which bundled track (0 or 1)
  customFile: File | null
  volume: number              // 0-1
  fadeOutDuration: 2          // seconds, fixed
}
```

## Coordinate Spaces

- **Full-canvas space (0–1):** CTA positions are stored in this space. It maps to the center-cropped, unzoomed view that fills the 1920x1080 output canvas.
- **Image space (pixels):** The original uploaded image coordinates. Center-crop calculates which portion maps to full-canvas space.
- **Viewport space (0–1):** The currently visible portion of the image during zoom. `canvasToViewport()` transforms from full-canvas to viewport for rendering CTAs at the correct position during zoom.

## Config Export Format

The JSON export includes all settings except `File` references:

```json
{
  "version": 1,
  "screenshots": [
    {
      "id": "screenshot_123_0",
      "filename": "hero.png",
      "checksum": "a1b2c3...",
      "duration": 5,
      "zoom": { "centerX": 0.5, "centerY": 0.3, "level": 2.0, "animateInDuration": 1 },
      "clicks": [{ "x": 0.3, "y": 0.5 }]
    }
  ],
  "music": {
    "source": "default",
    "trackIndex": 0,
    "volume": 0.7
  }
}
```

On import, files are matched by filename then validated by SHA-256 checksum.
