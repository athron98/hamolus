// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

/**
 * Vite config for the example panel.
 *
 * `host: true` binds to `0.0.0.0`, so the panel can be opened from another device on the LAN
 * (via `mac.lan`, say) for mobile testing that cannot be done from localhost. Port 5173 is
 * used by seo-dashboard; the other example panels take different ports so they can all run
 * at the same time.
 */
export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5173,
  },
})
