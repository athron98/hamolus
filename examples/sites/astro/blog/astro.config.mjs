// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'astro/config'

/**
 * Astro config for the blog example.
 *
 * `site` is set so `astro build` emits absolute canonical URLs for the sitemap and RSS.
 * Replace it with the real domain before deploying — left empty, the
 * `<link rel="canonical">` tag uses the localhost URL.
 *
 * No adapter: the build output is a purely static site. If this blog later needs server
 * rendering, add an adapter here and change `output` — not by moving the data fetching
 * logic. Fetching still runs on the Node host at build time, so `PUBLIC_HAMOLUS_ORIGIN`
 * has to point at a core the build machine can reach.
 *
 * The dev server binds to `0.0.0.0` so the site can be opened over `mac.lan` from other
 * devices.
 */
export default defineConfig({
  site: 'https://blog.example.com',
  output: 'static',
  server: {
    host: true,
    port: 4321,
  },
})
