// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'vite'

/**
 * Vite config for the console.
 *
 * There is no Solid plugin here, and that is not an oversight: `@hamolus/console` is
 * already built with its router, components, and stylesheet. The mounted console only
 * needs to serve one bundle.
 *
 * `host: true` binds to `0.0.0.0`, so the console can be opened from another device on the
 * LAN over `mac.lan` — useful when signing in from a phone while out.
 */
export default defineConfig({
  server: {
    host: true,
    port: 5176,
  },
})
