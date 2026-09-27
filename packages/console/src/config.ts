/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Bundled console defaults, overridable by a host application.
 *
 * A generated project has its own `console.config.ts` at the project root; the host
 * passes it to `mount({ config })`, which layers it over these defaults. It carries
 * host-level concerns only (which plugins, which endpoints) — never localization,
 * which lives in the core and is fetched from `GET /_meta/localization`, so a project
 * can add a locale without shipping a new console build.
 */

import {
  defineConsoleConfig,
  localeLabel,
  type ConsoleConfigInput,
  type ConsoleConfigOptions,
  type ResolvedLocalization,
} from '@hamolus/types'

const DEFAULTS = defineConsoleConfig({})

let current: ConsoleConfigInput = DEFAULTS

/**
 * Layer a host's config over the current one.
 *
 * A key the new config omits keeps its current value, so passing a config that only
 * lists plugins does not clear something set earlier. An explicit `undefined` is not
 * "omitted" — it falls through to the schema default, which for `plugins` means an
 * empty list.
 */
export function setConsoleConfig(config: ConsoleConfigOptions): void {
  current = defineConsoleConfig({ ...current, ...config })
}

/** The effective config, defaults included. */
export function getConsoleConfig(): ConsoleConfigInput {
  return current
}

/** Reset to the bundled defaults — used by tests. */
export function resetConsoleConfig(): void {
  current = DEFAULTS
}

/**
 * Stand-in for the core's answer while it is still in flight, and if it cannot be
 * reached at all. One English locale is the honest minimum: it is what the console
 * showed before localization existed, and it never pretends to be a language the
 * project might not have declared. `useLocalization()` replaces it as soon as the
 * core reports its real list.
 */
const PLACEHOLDER: ResolvedLocalization = {
  defaultLocale: 'en',
  locales: [{ code: 'en', label: 'English' }],
  multilingual: false,
}

/** The placeholder localization used before the core answers. */
export function fallbackLocalization(): ResolvedLocalization {
  return PLACEHOLDER
}

/** Locale preselected on a first visit, before the core's answer arrives. */
export function fallbackDefaultLocale(): string {
  return PLACEHOLDER.defaultLocale
}

/** Locale codes from the placeholder, in declaration order. */
export function fallbackLocaleCodes(): string[] {
  return PLACEHOLDER.locales.map((locale) => locale.code)
}

/** Human label for a placeholder locale code. */
export function fallbackLocaleLabel(code: string): string {
  return localeLabel(PLACEHOLDER, code)
}
