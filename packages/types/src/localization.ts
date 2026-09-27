/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Localization configuration, shared by the core, the console and the generated
 * `core.config.ts` / `console.config.ts` files.
 *
 * Localization is a *deployment* decision, not a runtime guess: a project declares
 * its locales up front so the core can validate a localized record before the
 * first row is written (a `{ en, id }` value for a project that only declares `en`
 * is a validation error, not something discovered later), and so the console can
 * render a language switcher without first probing settings.
 *
 * KV settings may still override the block at runtime — an operator can add a
 * locale without a redeploy — but the file is the starting point, and the merge is
 * one-directional: settings win field by field, never per locale.
 */

import { z } from 'zod'

/**
 * BCP-47-shaped code: a 2–3 letter language, optionally followed by a region or
 * script subtag (`en`, `id`, `pt-BR`, `zh-Hant`). Kept deliberately loose — the
 * core stores codes as keys, so the only real requirement is that a code is a
 * stable, lowercase-friendly identifier.
 */
export const LOCALE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export const localeDefinitionSchema = z
  .object({
    code: z
      .string()
      .regex(LOCALE_CODE_PATTERN, { message: 'Locale code must look like "en" or "pt-BR"' }),
    /** Human name for the switcher, e.g. `Bahasa Indonesia`. Falls back to the code. */
    label: z.string().trim().min(1).max(60).optional(),
    direction: z.enum(['ltr', 'rtl']).optional(),
  })
  .strict()

export type LocaleDefinition = z.infer<typeof localeDefinitionSchema>

/** A locale as stored in KV settings today: a bare code string. */
export const bareLocaleSchema = z.string().regex(LOCALE_CODE_PATTERN, {
  message: 'Locale code must look like "en" or "pt-BR"',
})

/**
 * The legacy settings shape — `localization.languages: ['en', 'id']` — still
 * accepted so existing projects keep working. See {@link resolveLocalization}.
 */
export const legacyLocalizationSchema = z
  .object({
    languages: z.array(bareLocaleSchema).min(1),
  })
  .strict()

export const localizationConfigSchema = z
  .object({
    /** Locale used when a record omits one. Must be one of `locales`. */
    defaultLocale: bareLocaleSchema,
    locales: z.array(localeDefinitionSchema).min(1).max(50),
  })
  .strict()
  .refine((config) => config.locales.some((locale) => locale.code === config.defaultLocale), {
    message: 'defaultLocale must be one of the declared locales',
    path: ['defaultLocale'],
  })

export type LocalizationConfig = z.infer<typeof localizationConfigSchema>

/** Effective localization after merging a file config with runtime settings. */
export interface ResolvedLocalization {
  defaultLocale: string
  locales: LocaleDefinition[]
  /** True when more than one locale exists, i.e. a language switcher is meaningful. */
  multilingual: boolean
}

/**
 * Normalise either config shape into {@link ResolvedLocalization}.
 *
 * Returns `undefined` when there is nothing usable, so callers can distinguish
 * "not configured" from "configured with zero locales" (which the schema forbids
 * anyway) and fall back to their own default.
 */
export function resolveLocalization(
  input: unknown,
): ResolvedLocalization | undefined {
  if (!input || typeof input !== 'object') return undefined

  const raw = input as Record<string, unknown>

  // Legacy `{ languages: string[] }` — settings written before the config files.
  if (Array.isArray(raw.languages)) {
    const codes = raw.languages.filter(
      (code): code is string => typeof code === 'string' && LOCALE_CODE_PATTERN.test(code),
    )
    if (codes.length === 0) return undefined
    const locales = dedupeLocales(codes.map((code) => ({ code })))
    const requested = typeof raw.defaultLocale === 'string' ? raw.defaultLocale : undefined
    return {
      defaultLocale: requested && locales.some((l) => l.code === requested) ? requested : locales[0]!.code,
      locales,
      multilingual: locales.length > 1,
    }
  }

  if (!Array.isArray(raw.locales)) return undefined

  const parsed = z.array(localeDefinitionSchema).safeParse(raw.locales)
  if (!parsed.success) return undefined

  const locales = dedupeLocales(parsed.data)
  if (locales.length === 0) return undefined

  const requested = typeof raw.defaultLocale === 'string' ? raw.defaultLocale : undefined
  const defaultLocale =
    requested && locales.some((locale) => locale.code === requested) ? requested : locales[0]!.code

  return { defaultLocale, locales, multilingual: locales.length > 1 }
}

/** First definition wins, so a duplicated code never doubles up in a switcher. */
function dedupeLocales(locales: LocaleDefinition[]): LocaleDefinition[] {
  const seen = new Set<string>()
  const out: LocaleDefinition[] = []
  for (const locale of locales) {
    if (seen.has(locale.code)) continue
    seen.add(locale.code)
    out.push(locale)
  }
  return out
}

/**
 * Merge two sources of localization, with `override` winning field by field.
 *
 * Used for file config + KV settings: settings replace the default locale and the
 * locale list outright when they declare any, so an operator adding a locale does
 * not get it merged with a stale list from the file.
 */
export function mergeLocalization(
  base: ResolvedLocalization | undefined,
  override: unknown,
): ResolvedLocalization | undefined {
  return resolveLocalization(override) ?? base
}

/** Locale codes in declaration order — what record validation needs. */
export function localeCodes(localization: ResolvedLocalization | undefined): string[] {
  return localization?.locales.map((locale) => locale.code) ?? []
}

/** Human label for a code, falling back to the code itself. */
export function localeLabel(localization: ResolvedLocalization | undefined, code: string): string {
  return localization?.locales.find((locale) => locale.code === code)?.label ?? code
}

/**
 * `core.config.ts` — project-level settings baked into the generated worker.
 *
 * Anything here is build-time and immutable at runtime; use KV settings for
 * values an operator must change without a redeploy.
 */
export const coreConfigSchema = z
  .object({
    localization: localizationConfigSchema.optional(),
  })
  .strict()

export type CoreConfig = z.infer<typeof coreConfigSchema>

/**
 * One entry of the console's plugin list.
 *
 * Declared here with a deliberately loose `component`: the value is a Solid
 * component, and `@hamolus/types` is loaded by the core Worker as well as the
 * browser, so it cannot import `solid-js` to type it. What *is* checked is the part
 * that is plain data — a snake_case id (it becomes a KV prefix segment), a name, a
 * description, an optional icon — plus the fact that `component` is callable, so a
 * forgotten import fails here with a readable message instead of crashing the
 * sidebar at render time. The console narrows `component` back to
 * `Component<PluginPageProps>` where it actually renders it.
 */
export const consolePluginSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'must be snake_case, starting with a letter'),
    name: z.string().min(1),
    description: z.string().min(1),
    icon: z.string().optional(),
    component: z.custom<(...args: never[]) => unknown>(
      (value) => typeof value === 'function',
      'must be the plugin page component exported by a plugin package',
    ),
  })
  .strict()

export type ConsoleConfigPlugin = z.infer<typeof consolePluginSchema>

/**
 * `console.config.ts` — host-level console configuration.
 *
 * Localization is deliberately **not** here. It is configured once, in the core
 * (`core.config.ts`, overridable from KV settings), and every consumer follows the
 * core automatically: the console renders its switcher from the public
 * `GET /_meta/localization`, and `@hamolus/panel` exposes the same answer through
 * `PanelClient.getLocalization()`. Mirroring the list in a console config gave the
 * project two places to edit, only one of which changed what the core validates.
 *
 * So this file is the home for concerns that are genuinely the *host's* — which
 * plugins a console ships, which endpoints it offers first — not for anything the
 * core already knows. It is strict, so a leftover `localization`/`defaultLocale`
 * fails loudly instead of being silently ignored.
 *
 * `plugins` is the only key today, and it is the whole plugin registration story:
 * a host lists its plugins here, `hamolus add plugin` appends to this list, and
 * `mount({ config })` hands the list to the console. That is deliberate — the console
 * ships as a Vite bundle, so a second file the host has to edit would be a file the
 * host does not own and cannot re-generate.
 */
export const consoleConfigSchema = z
  .object({
    plugins: z.array(consolePluginSchema).default([]),
  })
  .strict()

/** The resolved config: every key present, after validation and defaults. */
export type ConsoleConfigInput = z.infer<typeof consoleConfigSchema>

/**
 * What a host may pass: `plugins` is optional there, so `defineConsoleConfig({})` is
 * valid and means "no plugins". Kept separate from {@link ConsoleConfigInput} because
 * they differ here — every other config in this package is uniformly optional — and
 * conflating them would make the empty config a type error.
 */
export type ConsoleConfigOptions = z.input<typeof consoleConfigSchema>

function defineConfig<T>(schema: z.ZodType<T>, value: unknown, name: string): T {
  const parsed = schema.safeParse(value ?? {})
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`${name} is invalid — ${issues}`)
  }
  return parsed.data
}

/** Validate and type the object in a generated `core.config.ts`. */
export function defineCoreConfig(config: CoreConfig): CoreConfig {
  return defineConfig(coreConfigSchema, config, 'core.config.ts')
}

/** Validate and type the object in a generated `console.config.ts`. */
export function defineConsoleConfig(config: ConsoleConfigOptions): ConsoleConfigInput {
  return defineConfig(consoleConfigSchema, config, 'console.config.ts')
}
