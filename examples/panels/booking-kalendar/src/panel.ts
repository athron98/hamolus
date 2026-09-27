// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { createPanelRuntimeConfig, missingTokenMessage } from '@hamolus/panel'
import type { PanelRuntimeConfig } from '@hamolus/panel'

/**
 * This panel's wiring, read from the Vite env by the SDK.
 *
 * `id` must match the `id` in the panel manifest on the core exactly. The list of languages
 * is not written here: `locale` only picks the language for the first request, while the
 * full list is read from `GET /_meta/localization`.
 */
export const panel: PanelRuntimeConfig = createPanelRuntimeConfig(import.meta.env, {
  id: 'booking',
  name: 'Booking Calendar',
})

export { missingTokenMessage }
