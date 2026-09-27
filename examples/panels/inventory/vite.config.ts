// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

/**
 * Vite config for the example panel.
 *
 * `host: true` binds to `0.0.0.0`, so the panel can be opened from another device on the LAN
 * (via `mac.lan`, say) — handy when the stock recount is done from a phone. Port 5174 belongs
 * to inventory so it can run alongside seo-dashboard.
 */
export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5174,
  },
})
