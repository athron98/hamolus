// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { createPanelRuntimeConfig, missingTokenMessage } from '@hamolus/panel'
import type { PanelRuntimeConfig } from '@hamolus/panel'

/**
 * This panel's wiring, read from the Vite env by the SDK.
 *
 * Nothing project-specific lives in this file: `id` and `name` are the panel's identity on
 * the core, while `apiUrl`, `token`, `land`, `colony`, `defaultView`, and `locale` are all
 * resolved by `createPanelRuntimeConfig` from the env above.
 *
 * `id` must match the `id` in the panel manifest on the core exactly. The manifest is what
 * decides the views, the fields that may be read, and which operations the role of an
 * account is allowed — the panel never invents access for itself.
 */
export const panel: PanelRuntimeConfig = createPanelRuntimeConfig(import.meta.env, {
  id: 'seo',
  name: 'SEO Dashboard',
})

export { missingTokenMessage }
