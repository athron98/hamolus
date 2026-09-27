/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* The `currency` and `custom_currency` field types.                    */
/*                                                                     */
/* Both store a single `NUMERIC` amount and both are read back as an    */
/* object so a client never has to re-derive the formatting:            */
/*                                                                     */
/*   currency        → { base, currency, display }                     */
/*   custom_currency → { base, symbol, display }                        */
/*                                                                     */
/* Writes accept a bare number or that same object, so a read value can */
/* be written back unchanged.                                          */
/*                                                                     */
/* `currency` is an ISO 4217 code: the symbol and the decimal count     */
/* come from the code, the separators from the requested locale.        */
/* `custom_currency` has no code — the field declares its own symbol,   */
/* affixes and separators, which is what a non-currency unit (points,   */
/* credits, jam, Rp /bulan) actually needs.                             */
/* ------------------------------------------------------------------ */

/** ISO 4217 alphabetic code: three uppercase letters. */
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/

/** The code used when a `currency` field does not declare one. */
export const DEFAULT_CURRENCY = 'IDR'

/**
 * Currencies conventionally displayed **without** fraction digits. This is a
 * display convention, not the ISO 4217 minor unit — IDR is technically a
 * 2-minor-unit currency but is never shown with sen, and JPY/KRW/VND likewise.
 * A field can always override it with `decimals`.
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'IDR', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG',
  'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/**
 * Display symbols for the codes a project is likely to reach for. An unknown
 * code renders as itself (`SEK` → `SEK 1 000`), so this map is a convenience,
 * never a gate — any ISO 4217 code is accepted.
 */
export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  AUD: 'A$', BRL: 'R$', CAD: 'C$', CHF: 'CHF', CNY: '¥', DKK: 'kr',
  EUR: '€', GBP: '£', HKD: 'HK$', IDR: 'Rp', ILS: '₪', INR: '₹',
  JPY: '¥', KRW: '₩', MYR: 'RM', NOK: 'kr', NZD: 'NZ$', PHP: '₱',
  PLN: 'zł', SEK: 'kr', SGD: 'S$', THB: '฿', TRY: '₺', TWD: 'NT$',
  USD: '$', VND: '₫',
}

export const currencyCodeSchema = z
  .string()
  .regex(CURRENCY_CODE_PATTERN, 'Currency must be a 3-letter ISO 4217 code, e.g. "IDR"')

/** Where the symbol sits relative to the amount. */
export const CURRENCY_POSITIONS = ['before', 'after'] as const
export type CurrencyPosition = (typeof CURRENCY_POSITIONS)[number]

/** Sub-cent minor units are not a thing; 8 is plenty and keeps the column sane. */
export const CUSTOM_CURRENCY_DECIMALS = { min: 0, max: 8 } as const

export interface CustomCurrencyConfig {
  /** The currency glyph, e.g. `€`, `Rp`, `PTS`. Omit for a bare amount. */
  symbol?: string
  /** Literal text before everything, symbol included. */
  prefix?: string
  /** Literal text after everything, symbol included. */
  suffix?: string
  /** Whether `symbol` renders before or after the amount. Default `before`. */
  position?: CurrencyPosition
  /** A space between the symbol and the amount. Default `true`. */
  space?: boolean
  /** Fraction digits. Default `2`. */
  decimals?: number
  /** Thousands separators. Default `true`. */
  grouping?: boolean
  /** Default `,` */
  decimalSeparator?: string
  /** Default `.` */
  thousandSeparator?: string
  /**
   * How a negative amount renders. `{amount}` and `{symbol}` are substituted;
   * anything left in the pattern is literal. Default `-{amount}`.
   */
  negativePattern?: string
}

export const customCurrencyConfigSchema = z
  .object({
    symbol: z.string().trim().min(1).max(12).optional(),
    prefix: z.string().max(24).optional(),
    suffix: z.string().max(24).optional(),
    position: z.enum(CURRENCY_POSITIONS).optional(),
    space: z.boolean().optional(),
    decimals: z.number().int().min(CUSTOM_CURRENCY_DECIMALS.min).max(CUSTOM_CURRENCY_DECIMALS.max).optional(),
    grouping: z.boolean().optional(),
    decimalSeparator: z.string().min(1).max(3).optional(),
    thousandSeparator: z.string().min(1).max(3).optional(),
    negativePattern: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .refine((config) => (config.negativePattern?.includes('{amount}') ?? true), {
    message: 'negativePattern must contain {amount}',
    path: ['negativePattern'],
  })

/** `{ base, currency, display }` — the read shape of a `currency` field. */
export interface MoneyValue {
  /** The raw amount, in `currency`. Never a string. */
  base: number
  /** ISO 4217 code the amount is denominated in. */
  currency: string
  /** Formatted for `?locale=`, using the code's symbol and decimal count. */
  display: string
}

/** `{ base, symbol, display }` — the read shape of a `custom_currency` field. */
export interface CustomCurrencyValue {
  base: number
  /** The field's `symbol`, or `null` when it declares none. */
  symbol: string | null
  display: string
}

export const moneyValueSchema = z
  .object({ base: z.number(), currency: z.string(), display: z.string() })
  .strict()

export const customCurrencyValueSchema = z
  .object({ base: z.number(), symbol: z.string().nullable(), display: z.string() })
  .strict()

/** Both read shapes are accepted back on a write, so a round-trip is lossless. */
export const currencyWriteSchema = z.union([z.number(), moneyValueSchema, customCurrencyValueSchema])

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** The symbol for a code, falling back to the code itself. */
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code
}

/** `true` when the code has no minor unit. */
export function isZeroDecimalCurrency(code: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(code)
}

/** How many fraction digits a code is conventionally shown with. */
export function currencyDecimals(code: string): number {
  return isZeroDecimalCurrency(code) ? 0 : 2
}

/**
 * Separators for a locale. `en` is the only one worth special-casing: the
 * project declares BCP-47 codes, and every code that is not `en` follows the
 * same comma/dot convention (`id`, `pt-BR`, `de`, `fr` all write 1.500,00).
 */
function localeSeparators(locale?: string | null): { decimal: string; thousand: string } {
  return locale === 'en'
    ? { decimal: '.', thousand: ',' }
    : { decimal: ',', thousand: '.' }
}

/**
 * Render an amount with explicit separators — the shared engine behind both
 * field types. `1_500_000` with `{ decimalSeparator: ',', thousandSeparator: '.',
 * decimals: 2 }` and no symbol is `"1.500.000,00"`. A negative amount keeps a
 * leading `-`; the affixes are applied on top by `affix`.
 */
export function formatAmount(
  base: number,
  options: {
    decimals?: number
    grouping?: boolean
    decimalSeparator?: string
    thousandSeparator?: string
  } = {},
): string {
  if (base == null || !Number.isFinite(base)) return ''
  const defaults = localeSeparators(null)
  const decimals = options.decimals ?? 2
  const [whole = '', fraction] = Math.abs(base).toFixed(decimals).split('.')
  const grouped = options.grouping === false
    ? whole
    : whole.replace(/\B(?=(\d{3})+(?!\d))/g, options.thousandSeparator ?? defaults.thousand)
  const tail = fraction ? (options.decimalSeparator ?? defaults.decimal) + fraction : ''
  const body = `${grouped}${tail}`
  return base < 0 ? `-${body}` : body
}

/**
 * Whether a symbol is written flush against the amount. `$19.50` and `€10,00`
 * are, `Rp 250.000` and `zł 10,00` are not — and the rule that produces both is
 * simply the shape of the symbol: a lone non-alphabetic character is a
 * *suffix-like* glyph that binds to the digits, anything else is a wordmark that
 * needs air. Override per field with `space`.
 */
function symbolBindsFlush(symbol: string): boolean {
  return [...symbol].length === 1 && !/\p{L}|\p{N}/u.test(symbol)
}

interface AffixOptions {
  symbol?: string | null
  prefix?: string
  suffix?: string
  position?: CurrencyPosition
  space?: boolean
  negativePattern?: string
}

/**
 * Wrap a signed amount in the symbol and the literal affixes. A custom
 * `negativePattern` decides where the minus goes; the two neutral forms
 * (`{amount}` and `-{amount}`) fall through to a plain leading sign.
 */
function affix(signedAmount: string, options: AffixOptions): string {
  const negative = signedAmount.startsWith('-')
  const magnitude = negative ? signedAmount.slice(1) : signedAmount
  const symbol = options.symbol ?? ''
  const gap = options.space ?? (symbol ? !symbolBindsFlush(symbol) : false) ? ' ' : ''
  const symbolPart = symbol
    ? options.position === 'after' ? `${gap}${symbol}` : `${symbol}${gap}`
    : ''
  const composed = `${symbolPart}${magnitude}`

  const pattern = options.negativePattern ?? '-{amount}'
  const rendered = negative && pattern !== '{amount}' && pattern !== '-{amount}'
    ? pattern.replaceAll('{amount}', composed).replaceAll('{symbol}', symbol)
    : `${negative ? '-' : ''}${composed}`

  return `${options.prefix ?? ''}${rendered}${options.suffix ?? ''}`
}

/** Full options for `formatCurrencyDisplay` — the defaults a code implies. */
export interface CurrencyDisplayOptions extends AffixOptions {
  locale?: string | null
  /** Overrides the code's conventional decimal count. */
  decimals?: number
  grouping?: boolean
  decimalSeparator?: string
  thousandSeparator?: string
}

/**
 * Format a `currency` amount: the code's symbol, the code's decimal count, the
 * locale's separators. `formatCurrencyDisplay(250000, { code: 'IDR' })` →
 * `"Rp 250.000"`; `locale: 'en'` → `"Rp 250,000"`.
 */
export function formatCurrencyDisplay(
  base: number | null | undefined,
  options: { code?: string; locale?: string | null } & CurrencyDisplayOptions = {},
): string {
  if (base == null || !Number.isFinite(base)) return ''
  const code = options.code ?? DEFAULT_CURRENCY
  const defaults = localeSeparators(options.locale)
  const amount = formatAmount(base, {
    decimals: options.decimals ?? currencyDecimals(code),
    grouping: options.grouping,
    decimalSeparator: options.decimalSeparator ?? defaults.decimal,
    thousandSeparator: options.thousandSeparator ?? defaults.thousand,
  })
  return affix(amount, {
    symbol: options.symbol ?? currencySymbol(code),
    prefix: options.prefix,
    suffix: options.suffix,
    position: options.position,
    space: options.space,
    negativePattern: options.negativePattern,
  })
}

/**
 * Format a `custom_currency` amount from the field's own configuration.
 * `formatCustomCurrencyDisplay(1500000, { symbol: '€', suffix: ' /bln' })` →
 * `"€1.500.000,00 /bln"`.
 */
export function formatCustomCurrencyDisplay(
  base: number | null | undefined,
  config: CustomCurrencyConfig = {},
  locale?: string | null,
): string {
  if (base == null || !Number.isFinite(base)) return ''
  const defaults = localeSeparators(locale)
  const amount = formatAmount(base, {
    decimals: config.decimals ?? 2,
    grouping: config.grouping,
    decimalSeparator: config.decimalSeparator ?? defaults.decimal,
    thousandSeparator: config.thousandSeparator ?? defaults.thousand,
  })
  return affix(amount, {
    symbol: config.symbol ?? null,
    prefix: config.prefix,
    suffix: config.suffix,
    position: config.position,
    space: config.space,
    negativePattern: config.negativePattern,
  })
}

/** The `MoneyValue` a `currency` field serializes to. */
export function toMoneyValue(base: number, code?: string, locale?: string | null): MoneyValue {
  const currency = code ?? DEFAULT_CURRENCY
  return { base, currency, display: formatCurrencyDisplay(base, { code: currency, locale }) }
}

/** The `CustomCurrencyValue` a `custom_currency` field serializes to. */
export function toCustomCurrencyValue(
  base: number,
  config: CustomCurrencyConfig = {},
  locale?: string | null,
): CustomCurrencyValue {
  return {
    base,
    symbol: config.symbol ?? null,
    display: formatCustomCurrencyDisplay(base, config, locale),
  }
}

/**
 * The raw amount a write carries, whatever shape it arrived in. An object
 * contributes its `base`; anything else is coerced to a finite number or
 * `null`, which is what the column stores.
 */
export function currencyBaseOf(value: unknown): number | null {
  const raw = value && typeof value === 'object'
    ? (value as { base?: unknown }).base
    : value
  const n = Number(raw)
  return raw == null || raw === '' || Number.isNaN(n) ? null : n
}

/* ------------------------------------------------------------------ */
/* Compact notation — for dashboards and dense tables, not for money.   */
/* ------------------------------------------------------------------ */

/** 100000 → "100K", 1500000 → "1.5M", 900 → "900". */
export function compactNumber(base: number): string {
  if (base == null || !Number.isFinite(base)) return ''
  const part = (v: number) => {
    const s = String(Math.round(v * 10) / 10)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  const abs = Math.abs(base)
  const sign = base < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${part(abs / 1_000_000_000)}B`
  if (abs >= 1_000_000) return `${sign}${part(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}${part(abs / 1_000)}K`
  return `${sign}${abs}`
}
