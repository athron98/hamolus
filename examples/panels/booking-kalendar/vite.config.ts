// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

/**
 * Vite config for the example panel.
 *
 * `host: true` binds to `0.0.0.0`, so the panel can be opened from another device on the LAN
 * (via `mac.lan`, say) — a booking calendar is easiest to check from a phone. Port 5175 is
 * used by booking-kalendar so it can run alongside the other two examples.
 */
export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5175,
  },
})
