/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import type { ResolvedLocalization } from '@hamolus/types'
import { PanelError, isPanelRecord, normalizePanelError, panelResponseError } from './errors'
import type { PanelFetch } from './types'
import { normalizeApiBase } from './url'

/** Where to ask for the project's locales. */
export interface PanelLocalizationQuery {
  /** Core API base, e.g. `http://localhost:8787/api`. */
  apiBase: string
  /** Land scope, when the panel is bound to one. */
  land?: string
  /** Colony scope, when the panel is bound to one. */
  colony?: string
  /** Injectable for tests; defaults to the runtime's `fetch`. */
  fetch?: PanelFetch
  signal?: AbortSignal
}

/**
 * Read the project's locales from the core.
 *
 * `GET /_meta/localization` is public on purpose — a panel should be able to render
 * its locale switcher before anyone signs in — so this needs no token, and it works
 * as a standalone call in a panel that has no `PanelClient` yet.
 *
 * Returns `null` when the core answers but the project declares no locales, which is
 * a real answer ("this project is not localized"). A core that cannot be reached is
 * *not* that: it throws a `PanelError`, so a caller can tell "not localized" apart
 * from "unknown" and keep whatever locale it was already showing.
 */
export async function fetchPanelLocalization(
  query: PanelLocalizationQuery,
): Promise<ResolvedLocalization | null> {
  const apiBase = normalizeApiBase(query.apiBase)
  const url = `${apiBase}/_meta/localization`
  const fetcher = query.fetch ?? globalThis.fetch
  if (typeof fetcher !== 'function') {
    throw new PanelError('This runtime does not provide fetch', { code: 'FETCH_UNAVAILABLE' })
  }

  let response: Response
  let raw: string
  try {
    const headers = new Headers({ accept: 'application/json' })
    if (query.land) headers.set('x-land', query.land)
    if (query.colony) headers.set('x-colony', query.colony)
    response = await fetcher(url, { method: 'GET', headers, signal: query.signal })
    raw = await response.text()
  } catch (error) {
    throw normalizePanelError(error, 'Could not read the project localization', url)
  }

  let payload: unknown
  try {
    payload = raw.trim() ? JSON.parse(raw) : null
  } catch (error) {
    throw new PanelError('Localization response is not valid JSON', {
      status: response.status,
      code: 'INVALID_RESPONSE',
      url,
      cause: error,
    })
  }

  if (!response.ok) {
    throw panelResponseError(response, payload, raw, url, 'Localization request failed')
  }

  if (!isPanelRecord(payload) || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
    // The core answers `{ data: null }` for "this project is not localized" — that is a
    // real answer. A payload with no `data` key at all is not: it means the envelope
    // changed, and reporting "not localized" would silently drop every locale in the
    // panel instead of failing loudly.
    throw new PanelError('Localization response is missing the data envelope', {
      status: response.status,
      code: 'INVALID_RESPONSE',
      details: payload,
      url,
    })
  }

  const data = payload.data
  if (data === null) return null
  if (!isResolvedLocalization(data)) {
    throw new PanelError('Localization response is malformed', {
      status: response.status,
      code: 'INVALID_RESPONSE',
      details: data,
      url,
    })
  }
  return data
}

function isResolvedLocalization(value: unknown): value is ResolvedLocalization {
  if (!isPanelRecord(value)) return false
  if (typeof value.defaultLocale !== 'string') return false
  if (typeof value.multilingual !== 'boolean') return false
  if (!Array.isArray(value.locales)) return false
  return value.locales.every(
    (entry) => isPanelRecord(entry) && typeof entry.code === 'string' && typeof entry.label === 'string',
  )
}
