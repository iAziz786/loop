# Agent Guide

Start here. Read only what you need for the task at hand.

Do NOT add co-authored-by lines in commits.

## Quick Context

Loop is a browser-based product demo video creator. Svelte 5 + Vite + FFmpeg.wasm. Fully client-side.

**Commands:** `bun run dev`, `bun run build`, `bun run test` (needs dev server on port 5199)

## Which doc to read

| If your task involves... | Read |
|--------------------------|------|
| Understanding what Loop does | @docs/overview.md |
| What features exist and how they behave | @docs/features.md |
| Finding files, understanding code structure, key patterns | @docs/architecture.md |
| TypeScript interfaces, coordinate spaces, config format | @docs/data-model.md |
| Building, deploying, Cloudflare headers | @docs/deployment.md |
| Running or writing tests | @docs/testing.md |

Don't read everything. For a bug fix, you likely only need `architecture.md` to find the file, then read the code.

## Gotchas

- **Svelte 5 runes only** — this project uses `$state`, `$derived`, `$effect`. Files that use runes outside `.svelte` components must have the `.svelte.ts` extension (e.g., `state.svelte.ts`, `playback.svelte.ts`).
- **COOP/COEP headers required** — FFmpeg.wasm needs `SharedArrayBuffer`. Dev server headers are in `vite.config.ts`; production headers in `public/_headers` (Cloudflare Pages).
