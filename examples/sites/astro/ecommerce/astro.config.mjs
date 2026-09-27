// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'astro/config'

/**
 * Astro config for the catalog.
 *
 * `output: 'static'` stays in use even though the catalog is filtered — filters work through
 * the query string on the URL, and every filter combination that shows up becomes a static
 * page of its own. If the number of combinations is unbounded (free-form filters rather than
 * fixed categories), switch to `output: 'server'`; see the note in the README.
 *
 * The dev server binds to `0.0.0.0` so the site can be opened over `mac.lan` from other
 * devices.
 */
export default defineConfig({
  site: 'https://shop.example.com',
  output: 'static',
  server: {
    host: true,
    port: 4323,
  },
})
