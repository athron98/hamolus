// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'astro/config'

/**
 * Astro config for the corporate site.
 *
 * `site` is required and has to be correct: in this example the language list becomes part
 * of the URL (`/en/about`, `/id/about`), so `trailingSlash` also affects the canonical URL
 * written by `<link rel="canonical">`. A wrong site here means every page has two addresses
 * as far as a search engine is concerned.
 *
 * The dev server binds to `0.0.0.0` so the site can be opened over `mac.lan` from other
 * devices.
 */
export default defineConfig({
  site: 'https://hamolus.example.com',
  output: 'static',
  trailingSlash: 'always',
  server: {
    host: true,
    port: 4322,
  },
})
