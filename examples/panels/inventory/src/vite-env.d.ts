// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/// <reference types="vite/client" />

/**
 * Env contract for this panel.
 *
 * Vite only injects variables prefixed `VITE_` into `import.meta.env`, which is the only way
 * env reaches the browser. The list is deliberately duplicated here: `PanelRuntimeEnv` in
 * `@hamolus/panel` is the same shape, but TypeScript cannot know that `ImportMetaEnv` has
 * the same keys unless they are spelled out. Without this file,
 * `createPanelRuntimeConfig(import.meta.env, ...)` fails with "no properties in common".
 *
 * Every key is optional. An empty `VITE_PANEL_API_TOKEN` makes the SDK skip the request
 * entirely, and the panel shows a token-not-set message instead of a 401 from the core.
 */
interface ImportMetaEnv {
  readonly VITE_PANEL_API_URL?: string
  readonly VITE_PANEL_API_TOKEN?: string
  readonly VITE_PANEL_LAND?: string
  readonly VITE_PANEL_COLONY?: string
  readonly VITE_PANEL_DEFAULT_VIEW?: string
  readonly VITE_PANEL_LOCALE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
