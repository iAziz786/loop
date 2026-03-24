# Testing

## E2E Tests

The project uses Playwright for end-to-end testing against the running dev server.

### Setup

```bash
bun install
bunx playwright install chromium
```

### Running Tests

Start the dev server in one terminal:
```bash
bun run dev --port 5199
```

Run tests in another:
```bash
bun run test
```

### What's Tested (78 checks)

| Area | Checks |
|------|--------|
| Empty state | Drop zone renders, correct title |
| Upload | 3 screenshots appear, header updates |
| Selection | Settings panel, filename, duration |
| Zoom | Toggle, slider, level display, live drag |
| Canvas modes | Preview/Edit toggle, tool buttons |
| CTA placement | Click places marker, coordinates shown |
| Music | Track options, volume |
| Playback | Play/pause, scrub bar, time display |
| Canvas preview | Pixel rendering, seek, transitions, zoom overlay, CTA markers |
| Click-to-seek | Thumbnail click seeks preview |
| Arrow keys | Navigate between screenshots |
| FFmpeg rendering | Progress, success, download, file size |

### Test Images

Tests use programmatically generated split-color PNGs in `test-assets/` (gitignored).
