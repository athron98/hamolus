/// <reference types="vite/client" />

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

