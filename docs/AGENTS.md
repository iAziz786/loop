# Agent Guide

Start here. Read only what you need for the task at hand.

## Quick Context

Loop is a browser-based product demo video creator. Svelte 5 + Vite + FFmpeg.wasm. Fully client-side.

**Commands:** `bun run dev`, `bun run build`, `bun run test` (needs dev server on port 5199)

## Which doc to read

| If your task involves... | Read |
|--------------------------|------|
| Understanding what Loop does | [overview.md](overview.md) |
| What features exist and how they behave | [features.md](features.md) |
| Finding files, understanding code structure, key patterns | [architecture.md](architecture.md) |
| TypeScript interfaces, coordinate spaces, config format | [data-model.md](data-model.md) |
| Building, deploying, Cloudflare headers | [deployment.md](deployment.md) |
| Running or writing tests | [testing.md](testing.md) |

## Don't read everything

For a bug fix, you likely only need `architecture.md` to find the file, then read the code. For a new feature, start with `features.md` for context, then `architecture.md` for where to put it. For deployment issues, go straight to `deployment.md`.
