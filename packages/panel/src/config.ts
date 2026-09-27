/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { normalizeApiBase } from './url'

/**
 * The Vite environment a generated panel reads its wiring from.
 *
 * Declared as a shape rather than pulled from `vite/client`, so `@hamolus/panel`
 * stays a plain TypeScript library with no build-time coupling to a bundler.
 */
export interface PanelRuntimeEnv {
  VITE_PANEL_API_URL?: string
  VITE_PANEL_API_TOKEN?: string
  VITE_PANEL_LAND?: string
  VITE_PANEL_COLONY?: string
  VITE_PANEL_DEFAULT_VIEW?: string
  /**
   * Locale preselected before the core answers. It is only a starting guess: the
   * project decides the real list, via `PanelClient.getLocalization()`.
   */
  VITE_PANEL_LOCALE?: string
}

/** Everything a generated panel needs to talk to the core, resolved from the env. */
export interface PanelRuntimeConfig {
  id: string
  name: string
  apiUrl: string
  token: string
  land?: string
  colony?: string
  defaultView?: string
  locale?: string
}

/** Overrides for values the CLI substitutes into a generated panel. */
export interface PanelRuntimeOverrides {
  id?: string
  name?: string
}

/** The API base a fresh panel talks to when nothing is configured. */
export const DEFAULT_PANEL_API_URL = 'http://localhost:8787/api'

function optionalEnv(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

/**
 * Read a panel's wiring out of its Vite env.
 *
 * Everything is normalised here — the base URL goes through {@link normalizeApiBase}
 * so a bare `http://localhost:8787` gains the `/api` suffix the client expects, and
 * blank variables become `undefined` rather than empty strings that would later be
 * sent as an empty `x-land` header.
 */
export function createPanelRuntimeConfig(
  env: PanelRuntimeEnv,
  overrides: PanelRuntimeOverrides = {},
): PanelRuntimeConfig {
  const id = overrides.id?.trim()
  const name = overrides.name?.trim()
  if (!id) {
    throw new TypeError('A panel id is required')
  }
  if (!name) {
    throw new TypeError(`Panel "${id}" needs a name`)
  }
  return {
    id,
    name,
    apiUrl: normalizeApiBase(optionalEnv(env.VITE_PANEL_API_URL) ?? DEFAULT_PANEL_API_URL),
    token: optionalEnv(env.VITE_PANEL_API_TOKEN) ?? '',
    land: optionalEnv(env.VITE_PANEL_LAND),
    colony: optionalEnv(env.VITE_PANEL_COLONY),
    defaultView: optionalEnv(env.VITE_PANEL_DEFAULT_VIEW),
    locale: optionalEnv(env.VITE_PANEL_LOCALE),
  }
}

/**
 * A bundler-neutral "token is required" error from `PanelClient` leaves a fresh app
 * with no clue where the token belongs. Name the variable and the endpoint that
 * mints one, so the first run is self-explanatory.
 *
 * Returns `null` once a token is configured.
 */
export function missingTokenMessage(config: Pick<PanelRuntimeConfig, 'token'>): string | null {
  if (config.token) return null
  return [
    'VITE_PANEL_API_TOKEN is not set.',
    "Mint a token for a panel user and put it in this app's .env, for example:",
    '  POST /api/_auth/login  { "username": "<panel_user>", "password": "…" }  ->  data.token',
  ].join('\n')
}
