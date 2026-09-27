// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { createPanelRuntimeConfig, missingTokenMessage } from '@hamolus/panel'
import type { PanelRuntimeConfig } from '@hamolus/panel'

/**
 * This panel's wiring, read from the Vite env by the SDK.
 *
 * `id` must match the `id` in the panel manifest on the core exactly. The manifest is what
 * decides the collection, the fields that may be written, and which operations the role of
 * an account is allowed — this panel grants no access of its own.
 */
export const panel: PanelRuntimeConfig = createPanelRuntimeConfig(import.meta.env, {
  id: 'inventory',
  name: 'Inventory',
})

export { missingTokenMessage }
