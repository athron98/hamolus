import { createEffect, createSignal } from 'solid-js'

export type ContainerMode = 'on' | 'off'

const STORAGE_KEY = 'console-container'

function initialContainer(): ContainerMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off' ? 'off' : 'on'
  } catch {
    return 'on'
  }
}

export const [container, setContainer] = createSignal<ContainerMode>(initialContainer())

createEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, container())
  } catch {
    /* ignore */
  }
})

export function toggleContainer(): void {
  setContainer((c) => (c === 'on' ? 'off' : 'on'))
}

const PINS_KEY = 'console-pinned'

function initialPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === 'string' && /^[a-z][a-z0-9_]*$/.test(n))
      : []
  } catch {
    return []
  }
}

export const [pinned, setPinned] = createSignal<string[]>(initialPinned())

createEffect(() => {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(pinned()))
  } catch {
    /* ignore */
  }
})

export function togglePin(name: string): void {
  setPinned((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
}

export type NavMode = 'full' | 'icons'

const NAV_MODE_KEY = 'console-nav-mode'
const NAV_AUTO_KEY = 'console-nav-auto'

function initialNavMode(): NavMode {
  try {
    return localStorage.getItem(NAV_MODE_KEY) === 'icons' ? 'icons' : 'full'
  } catch {
    return 'full'
  }
}

function initialNavAuto(): boolean {
  try {
    return localStorage.getItem(NAV_AUTO_KEY) === 'on'
  } catch {
    return false
  }
}

export const [navMode, setNavMode] = createSignal<NavMode>(initialNavMode())
export const [navAutoHide, setNavAutoHide] = createSignal<boolean>(initialNavAuto())

createEffect(() => {
  try {
    localStorage.setItem(NAV_MODE_KEY, navMode())
    localStorage.setItem(NAV_AUTO_KEY, navAutoHide() ? 'on' : 'off')
  } catch {
    /* ignore */
  }
})