import { createEffect, createSignal } from 'solid-js'

const STORAGE_KEY = 'console-locale'

function initialLocale(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en'
  } catch {
    return 'en'
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
