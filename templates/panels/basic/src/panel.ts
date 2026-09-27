// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { createPanelRuntimeConfig, missingTokenMessage } from '@hamolus/panel'
import type { PanelRuntimeConfig } from '@hamolus/panel'

/**
 * This panel's wiring, read from the Vite env by the SDK.
 *
 * There is nothing project-specific here on purpose: the id and name are baked in by
 * the generator, and everything else (`VITE_PANEL_API_URL`, `VITE_PANEL_API_TOKEN`,
 * `VITE_PANEL_LAND`, `VITE_PANEL_COLONY`, `VITE_PANEL_DEFAULT_VIEW`,
 * `VITE_PANEL_LOCALE`) is resolved by `createPanelRuntimeConfig`.
 *
 * Localization is the core's business, not this file's. `panel.locale` only
 * preselects a locale for the very first request; the real list — and the project's
 * default — comes from `client.getLocalization()`, so adding a language to the core
 * needs no change here.
 */
export const panel: PanelRuntimeConfig = createPanelRuntimeConfig(import.meta.env, {
  id: '{{PANEL_ID}}',
  name: '{{PANEL_NAME}}',
})

export { missingTokenMessage }
export type { PanelRuntimeConfig }
