/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal } from 'solid-js'

export type ThemeMode = 'dark' | 'light'
export type FontId = 'system' | 'inter' | 'geist' | 'plex' | 'roboto'

export interface FontOption {
  id: FontId
  name: string
}

/** Selectable UI fonts — `html[data-font]` repaints `--font-sans` everywhere. */
export const FONTS: FontOption[] = [
  { id: 'inter', name: 'Inter' },
  { id: 'system', name: 'System UI' },
  { id: 'geist', name: 'Geist' },
  { id: 'plex', name: 'IBM Plex' },
  { id: 'roboto', name: 'Roboto' },
]

export type PaletteId =
  | 'blue' | 'azure' | 'cyan' | 'teal'
  | 'green' | 'lime' | 'amber' | 'gold'
  | 'orange' | 'coral' | 'crimson' | 'rose'
  | 'pink' | 'violet' | 'indigo' | 'slate'

export interface ThemePalette {
  id: PaletteId
  name: string
  dark: string
  light: string
}

/**
 * The full palette set. Selecting a theme repaints the entire app (surfaces,
 * text and accent) for the current mode via `index.css`. `dark`/`light` are the
 * accent hexes per mode, used for the popover swatches.
 */
export const THEMES: ThemePalette[] = [
  { id: 'blue', name: 'Sapphire', dark: '#6d8bff', light: '#2f6ee0' },
  { id: 'azure', name: 'Sky', dark: '#4da8ff', light: '#1a73e8' },
  { id: 'cyan', name: 'Cyan', dark: '#2fe0f0', light: '#0e98b8' },
  { id: 'teal', name: 'Lagoon', dark: '#34cfb8', light: '#0f8f87' },
  { id: 'green', name: 'Emerald', dark: '#3edb95', light: '#12915a' },
  { id: 'lime', name: 'Lime', dark: '#a7dd45', light: '#689f38' },
  { id: 'amber', name: 'Amber', dark: '#fbc02d', light: '#ad6d14' },
  { id: 'gold', name: 'Gold', dark: '#f2c94c', light: '#a16207' },
  { id: 'orange', name: 'Orange', dark: '#ffa53c', light: '#e65100' },
  { id: 'coral', name: 'Coral', dark: '#ff7768', light: '#d8483a' },
  { id: 'crimson', name: 'Crimson', dark: '#ff5c6c', light: '#c6233f' },
  { id: 'rose', name: 'Rose', dark: '#f472b6', light: '#c9448a' },
  { id: 'pink', name: 'Pink', dark: '#e56aef', light: '#a62bb3' },
  { id: 'violet', name: 'Amethyst', dark: '#a78bfa', light: '#7c4dcc' },
  { id: 'indigo', name: 'Indigo', dark: '#818cf8', light: '#4f46c9' },
  { id: 'slate', name: 'Slate', dark: '#94a3b8', light: '#5a6b83' },
]

interface ThemeState {
  mode: ThemeMode
  palette: PaletteId
  font: FontId
}

const STORAGE_KEY = 'console-theme'
const DEFAULT_PALETTE: PaletteId = 'blue'
const LIGHT_DEFAULT_PALETTE: PaletteId = 'amber'
const DEFAULT_FONT: FontId = 'inter'

/* Legacy 5-preset ids -> { mode, palette }, so existing saved themes survive. */
const LEGACY_PRESETS: Record<string, ThemeState> = {
  midnight: { mode: 'dark', palette: 'blue', font: DEFAULT_FONT },
  dusk: { mode: 'dark', palette: 'violet', font: DEFAULT_FONT },
  silver: { mode: 'dark', palette: 'amber', font: DEFAULT_FONT },
  paper: { mode: 'light', palette: 'amber', font: DEFAULT_FONT },
  mist: { mode: 'light', palette: 'blue', font: DEFAULT_FONT },
}

function isMode(v: unknown): v is ThemeMode {
  return v === 'dark' || v === 'light'
}

function isPalette(v: unknown): v is PaletteId {
  return typeof v === 'string' && THEMES.some((t) => t.id === v)
}

function isFont(v: unknown): v is FontId {
  return typeof v === 'string' && FONTS.some((f) => f.id === v)
}

/**
 * Reads the stored theme. Accepts the current `{ mode, palette, font }` JSON, the
 * legacy `{ mode, accent }` JSON (accents all map onto a palette id), the
 * legacy bare `'dark'`/`'light'` strings, and the legacy preset ids
 * (`midnight`/`dusk`/`silver`/`paper`/`mist`) -- all mapped onto mode + palette.
 */
function parseTheme(): ThemeState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  if (raw) {
    const preset = LEGACY_PRESETS[raw]
    if (preset) return preset
    if (raw === 'dark') return { mode: 'dark', palette: DEFAULT_PALETTE, font: DEFAULT_FONT }
    if (raw === 'light') return { mode: 'light', palette: LIGHT_DEFAULT_PALETTE, font: DEFAULT_FONT }
    try {
      const p = JSON.parse(raw) as {
        mode?: unknown
        palette?: unknown
        accent?: unknown
        font?: unknown
      }
      if (isMode(p.mode)) {
        const palette = isPalette(p.palette)
          ? p.palette
          : isPalette(p.accent)
            ? p.accent
            : p.mode === 'light'
              ? LIGHT_DEFAULT_PALETTE
              : DEFAULT_PALETTE
        return { mode: p.mode, palette, font: isFont(p.font) ? p.font : DEFAULT_FONT }
      }
    } catch {
      /* fall through */
    }
  }
  const prefersLight =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
  return prefersLight
    ? { mode: 'light', palette: LIGHT_DEFAULT_PALETTE, font: DEFAULT_FONT }
    : { mode: 'dark', palette: DEFAULT_PALETTE, font: DEFAULT_FONT }
}

const initial = parseTheme()

export const [mode, setMode] = createSignal<ThemeMode>(initial.mode)
export const [palette, setPalette] = createSignal<PaletteId>(initial.palette)
export const [font, setFont] = createSignal<FontId>(initial.font)

function persist(state: ThemeState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode: state.mode, palette: state.palette, font: state.font }),
    )
  } catch {
    /* ignore */
  }
}

function commit(state: ThemeState): void {
  setMode(state.mode)
  setPalette(state.palette)
  setFont(state.font)
  const html = document.documentElement
  html.dataset.mode = state.mode
  html.dataset.theme = state.palette
  html.dataset.font = state.font
  persist(state)
}

/* Ensure the DOM always reflects the stored theme -- if the pre-hydration script
   (index.html) and this parser ever disagree about a stored value, the correct
   palette is committed to the document before first paint of the app. */
commit(initial)

/** Apply just the light/dark mode, keeping the current palette and font. */
export function applyMode(next: ThemeMode): void {
  commit({ mode: next, palette: palette(), font: font() })
}

/** Apply a full palette, keeping the current mode and font. */
export function applyPalette(next: PaletteId): void {
  commit({ mode: mode(), palette: next, font: font() })
}

/** Apply a UI font, keeping the current mode and palette. */
export function applyFont(next: FontId): void {
  commit({ mode: mode(), palette: palette(), font: next })
}

export const isDark = () => mode() === 'dark'

export function toggleTheme(): void {
  applyMode(isDark() ? 'light' : 'dark')
}
