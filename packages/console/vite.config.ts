import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import stylex from '@stylexjs/unplugin'

export default defineConfig({
  plugins: [
    // StyleX must be registered before the framework plugin (Fast Refresh).
    stylex.vite({
      useCSSLayers: true,
    }),
    solid(),
  ],
  optimizeDeps: {
    // The contracts package exposes its tokens as a raw `*.stylex.ts` subpath so
    // this app's StyleX compiler emits the palette variables. Pre-bundling would
    // strip that file through esbuild, which cannot see the theme.
    exclude: ['@hamolus/plugin-console-contracts'],
  },
  server: {
    port: 5173,
    // Allow access via other hosts (e.g. hermes.lan / LAN IP) in dev.
    allowedHosts: true,
    proxy: {
      // In dev, /api is proxied to the core worker (wrangler dev default: 8787).
      '/api': {
        target: process.env.CORE_API_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
      // Media file URLs resolve to ${origin}/media/{key}; the trailing-slash
      // scope keeps the SPA route /media (the media manager page) inside Vite.
      '/media/': {
        target: process.env.CORE_API_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
  },
})