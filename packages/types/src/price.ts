import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* The `price` field type: a single IDR base number with a derived      */
/* display string. `base` is always the IDR number; `display` is a      */
/* full localized phrase — "mulai dari IDR 100K" for id, "Start from    */
/* $8" (USD, 20 % markup, ceil) for en. The conversion rate is the     */
/* same default the site's rates.ts falls back to; the site re-applies */
/* the live rate at runtime via [data-idr], so SSR uses a stable value  */
/* and the browser refines it.                                         */
/* ------------------------------------------------------------------ */

export const USD_MARKUP = 1.2
export const DEFAULT_USD_RATE = 16000

export interface PriceDisplay {
  base: number
  display: string
}

export const priceValueSchema = z
  .object({ base: z.number(), display: z.string() })
  .strict()

function compactPart(v: number): string {
  const s = String(Math.round(v * 10) / 10)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

/** 100000 → "100K", 1500000 → "1.5M", 900 → "900". */
export function compactIdr(base: number): string {
  if (base >= 1_000_000) return `${compactPart(base / 1_000_000)}M`
  if (base >= 1_000) return `${compactPart(base / 1_000)}K`
  return String(base)
}

/** Format a `price` base for display. `en` → "Start from $…" (USD,
 *  markup, ceil, default rate); anything else → "mulai dari IDR …"
 *  (compact IDR). Null/NaN → ''. */
export function formatPriceDisplay(
  base: number | null | undefined,
  locale?: string | null,
): string {
  if (base == null || !Number.isFinite(base)) return ''
  if (locale === 'en') {
    const usd = Math.ceil((base / DEFAULT_USD_RATE) * USD_MARKUP)
    return 'Start from $' + usd.toLocaleString('en-US')
  }
  return 'mulai dari IDR ' + compactIdr(base)
}