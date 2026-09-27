/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createSignal } from 'solid-js'
import { fallbackDefaultLocale } from '../config'

const STORAGE_KEY = 'console-locale'

/**
 * A stored choice wins; otherwise the console opens in English until the core
 * reports its locales, at which point `useLocalization()` switches to the project's
 * own default (and corrects a stored value the project no longer declares).
 */
function initialLocale(): string {
  const fallback = fallbackDefaultLocale()
  try {
    return localStorage.getItem(STORAGE_KEY) || fallback
  } catch {
    return fallback
  }
}

export const [locale, setLocale] = createSignal(initialLocale())

createEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, locale())
  } catch {
    /* ignore */
  }
})
