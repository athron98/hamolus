// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'vite'

/**
 * Plain Vite. No `vite-plugin-solid`, no StyleX plugin, no JSX: the console is
 * consumed as a pre-built library, so the host only needs to serve `index.html`,
 * `console.config.ts` and the entry module.
 */
export default defineConfig({
  build: {
    // Left at Vite's default `base: '/'` on purpose. The console routes on the
    // client (`/collections/:name`, `/panels/:id`, …) and the deploy target serves
    // it from the domain root, so root-absolute asset URLs are what keeps a deep
    // link working: `wrangler.jsonc` sends unknown paths back to `index.html`
    // (`not_found_handling: single-page-application`), and a *relative* base would
    // resolve `./assets/…` against `/collections/` and 404. If you ever front this
    // app under a prefix, set `base` to that prefix here *and* stop rewriting
    // unknown paths to index.html.
    outDir: 'dist',
    emptyOutDir: true,
    // `@hamolus/console` ships as one pre-built module, so the host cannot split it
    // — the default 500 kB warning would fire on every build of every generated
    // app and train people to ignore it. ~830 kB raw / ~230 kB gzipped is the size
    // the console is expected to be; raise the ceiling rather than chase it.
    chunkSizeWarningLimit: 1200,
  },
})
