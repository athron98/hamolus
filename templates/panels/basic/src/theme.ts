// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { createSignal } from 'solid-js'

/**
 * Panel appearance — mode + palette + font, persisted in `localStorage` and
 * mirrored onto `html[data-mode|data-theme|data-font]` so the CSS custom
 * properties in `panel.css` re-theme the whole app live.
 *
 * This is a deliberately small port of the console's `lib/theme.ts`: same
 * attributes, same palettes, same storage shape, so a panel feels like the
 * console. The pre-hydration script in `index.html` parses the same values, so
 * keep the two in sync.
 */
export type Mode = 'dark' | 'light'

export type PaletteId =
  | 'blue'
  | 'azure'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'lime'
  | 'amber'
  | 'gold'
  | 'orange'
  | 'coral'
  | 'crimson'
  | 'rose'
  | 'pink'
  | 'violet'
  | 'indigo'
  | 'slate'

export type FontId = 'system' | 'inter' | 'geist' | 'plex' | 'roboto'

export const PALETTES: ReadonlyArray<{ id: PaletteId; name: string; hex: string }> = [
  { id: 'blue', name: 'Sapphire', hex: '#6d8bff' },
  { id: 'azure', name: 'Sky', hex: '#4da8ff' },
  { id: 'cyan', name: 'Aqua', hex: '#2fe0f0' },
  { id: 'teal', name: 'Lagoon', hex: '#34cfb8' },
  { id: 'green', name: 'Emerald', hex: '#3edb95' },
  { id: 'lime', name: 'Lime', hex: '#a7dd45' },
  { id: 'amber', name: 'Amber', hex: '#fbc02d' },
  { id: 'gold', name: 'Gold', hex: '#f2c94c' },
  { id: 'orange', name: 'Orange', hex: '#ffa53c' },
  { id: 'coral', name: 'Coral', hex: '#ff7768' },
  { id: 'crimson', name: 'Crimson', hex: '#ff5c6c' },
  { id: 'rose', name: 'Rose', hex: '#f472b6' },
  { id: 'pink', name: 'Pink', hex: '#e56aef' },
  { id: 'violet', name: 'Amethyst', hex: '#a78bfa' },
  { id: 'indigo', name: 'Indigo', hex: '#818cf8' },
  { id: 'slate', name: 'Slate', hex: '#94a3b8' },
]

export const FONTS: ReadonlyArray<{ id: FontId; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'inter', label: 'Inter' },
  { id: 'geist', label: 'Geist' },
  { id: 'plex', label: 'Plex' },
  { id: 'roboto', label: 'Roboto' },
]

const STORAGE_KEY = 'panel-theme'

function isMode(value: unknown): value is Mode {
  return value === 'dark' || value === 'light'
}

function isPalette(value: unknown): value is PaletteId {
  return PALETTES.some((palette) => palette.id === value)
}

function isFont(value: unknown): value is FontId {
  return FONTS.some((font) => font.id === value)
}

function parse(): { mode: Mode; palette: PaletteId; font: FontId } {
  const fallbackMode: Mode =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'

  let mode: Mode | null = null
  let palette: PaletteId | null = null
  let font: FontId = 'inter'

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light') {
      mode = raw
    } else if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown> | null
      if (parsed && isMode(parsed.mode)) {
        mode = parsed.mode
        if (isPalette(parsed.palette)) palette = parsed.palette
        else if (isPalette(parsed.theme)) palette = parsed.theme
        if (isFont(parsed.font)) font = parsed.font
      }
    }
  } catch {
    // Storage can be unavailable (private mode); fall through to the defaults.
  }

  const resolvedMode = mode ?? fallbackMode
  return {
    mode: resolvedMode,
    palette: palette ?? (resolvedMode === 'light' ? 'amber' : 'blue'),
    font,
  }
}

const initial = parse()

const [mode, setModeSignal] = createSignal<Mode>(initial.mode)
const [palette, setPaletteSignal] = createSignal<PaletteId>(initial.palette)
const [font, setFontSignal] = createSignal<FontId>(initial.font)

function commit() {
  const root = document.documentElement
  root.dataset.mode = mode()
  root.dataset.theme = palette()
  root.dataset.font = font()

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode: mode(), palette: palette(), font: font() }),
    )
  } catch {
    // Persisting is best-effort; the DOM is already updated.
  }
}

/** Keep the DOM honest even if the pre-hydration script was skipped. */
commit()

export function isDark(): boolean {
  return mode() === 'dark'
}

export function applyMode(next: Mode) {
  setModeSignal(next)
  commit()
}

export function applyPalette(next: PaletteId) {
  setPaletteSignal(next)
  commit()
}

export function applyFont(next: FontId) {
  setFontSignal(next)
  commit()
}

export function toggleMode() {
  applyMode(mode() === 'dark' ? 'light' : 'dark')
}

export { font, mode, palette }
