/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Where the console gets its locales.
 *
 * The core is the only place localization is configured (`core.config.ts`, overridable
 * from KV settings), because the core is what validates every localized record against
 * that list. The console asks it over the public `GET /_meta/localization` and mirrors
 * the answer — a project can add a locale without shipping a new console build, and
 * there is no second list to keep in sync.
 *
 * Until that request resolves (or if it fails) the console shows a single English
 * placeholder rather than a guess, so a first paint never claims a language the project
 * might not have declared.
 *
 * This replaces the same `settings.localization.languages` parsing that used to be
 * copy-pasted into the layout and the records page, and it keeps the global
 * `locale()` signal honest: a stored locale that the project does not declare is
 * corrected to the project's default rather than left to fail form validation.
 */

import { createQuery } from '@tanstack/solid-query'
import { createEffect } from 'solid-js'
import { localeCodes, resolveLocalization, type ResolvedLocalization } from '@hamolus/types'
import { api } from '../lib/api'
import { locale, setLocale } from '../lib/locale'
import { fallbackDefaultLocale, fallbackLocaleCodes, fallbackLocaleLabel } from '../config'

export interface Localization {
  /** Locale codes in declaration order. */
  languages(): string[]
  /** Human label per code; falls back to the code itself. */
  labels(): Record<string, string>
  defaultLocale(): string
  /** True when the project declares more than one locale. */
  multilingual(): boolean
  /** True while the core's answer has not arrived (placeholder in use). */
  fromFallback(): boolean
}

/** The project localization, with a single English placeholder while it loads. */
export function useLocalization(): Localization {
  const query = createQuery(() => ({
    queryKey: ['localization'],
    queryFn: async () => resolveLocalization((await api.getLocalization()).data),
  }))

  // Keep the active locale inside the project's declared set. A stale localStorage
  // value — or a locale an operator removed — would otherwise surface as a record
  // form that cannot validate.
  createEffect(() => {
    const resolved = query.data
    if (!resolved) return
    if (!resolved.locales.some((entry) => entry.code === locale())) {
      setLocale(resolved.defaultLocale)
    }
  })

  const resolved = (): ResolvedLocalization | undefined => query.data

  const languages = (): string[] => {
    const value = resolved()
    return value ? localeCodes(value) : fallbackLocaleCodes()
  }

  return {
    languages,
    labels: () => {
      const value = resolved()
      const map: Record<string, string> = {}
      for (const code of languages()) {
        map[code] = value?.locales.find((entry) => entry.code === code)?.label ?? fallbackLocaleLabel(code)
      }
      return map
    },
    defaultLocale: () => resolved()?.defaultLocale ?? fallbackDefaultLocale(),
    multilingual: () => languages().length > 1,
    fromFallback: () => query.isLoading && query.data === undefined,
  }
}
