// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Build-time configuration for the {{PROJECT_LABEL}} core.
 *
 * This file is imported by `src/index.ts` and bundled into the Worker, so a change
 * here needs a deploy — which is the point: these are decisions you want to see in
 * a code review, not something an operator can change by accident.
 *
 * Anything that *is* changed at runtime belongs in KV settings instead (edit it on
 * the console's Config screen). The core merges the two, with settings winning; the
 * merge happens in `@hamolus/core`, applied by `src/index.ts`.
 */

import { defineCoreConfig } from '@hamolus/types'

export const config = defineCoreConfig({
  /**
   * Locales for `localized: true` fields. The first entry is the default used when a
   * record omits a locale, and the list is enforced on write: a `{ en, id }` value is
   * rejected when only `en` is declared here.
   *
   * A project with one locale still works — the console simply hides its language
   * selector. Add a locale by editing this file, or by writing
   * `localization` in KV settings, whichever suits the change.
   */
  localization: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'id', label: 'Bahasa Indonesia' },
    ],
  },
})

export default config
