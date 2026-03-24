# Deployment

**Production:** https://loop.iaziz786.com/ (Cloudflare Pages)

## Required Headers

FFmpeg.wasm requires `SharedArrayBuffer`, which browsers only enable with these HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The Vite dev server is already configured with these headers. For production on Cloudflare, configure them in `_headers`.

## Build

```bash
bun install
bun run build
```

Output goes to `dist/`.

## Cloudflare Pages

### 1. Connect your repo to Cloudflare Pages

- Build command: `bun run build`
- Build output directory: `dist`
- Node.js compatibility flag: enable if needed for Bun

### 2. Add headers

Create `public/_headers` (copied to `dist/` at build time):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### 3. Or use a `_worker.js` for Cloudflare Workers Sites

If deploying as a Worker instead of Pages, add the headers in the worker:

```js
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return newResponse;
  },
};
```

## Constraints

- **Rendering speed:** FFmpeg.wasm is ~10x slower than native. A 30s video may take 30–60s to render.
- **Memory:** Browser limit ~2GB. Images >4K are downscaled on upload. Warning at 15+ screenshots.
- **Browser support:** Requires SharedArrayBuffer (Chrome 92+, Firefox 79+, Safari 15.2+).
