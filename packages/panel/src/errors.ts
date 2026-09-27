/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

export interface ApiErrorOptions {
  status?: number
  code?: string
  details?: unknown
  url?: string
  cause?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly url?: string

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code ?? 'API_ERROR'
    this.details = options.details
    this.url = options.url
  }
}

export class PanelError extends ApiError {
  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options)
    this.name = 'PanelError'
  }
}

export function normalizePanelError(
  error: unknown,
  fallbackMessage = 'Panel request failed',
  url?: string,
): PanelError {
  if (error instanceof PanelError) return error
  if (error instanceof ApiError) {
    return new PanelError(error.message, {
      status: error.status,
      code: error.code,
      details: error.details,
      url: error.url ?? url,
      cause: error.cause ?? error,
    })
  }
  if (error instanceof Error) {
    return new PanelError(error.message || fallbackMessage, {
      status: 0,
      code: error.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR',
      url,
      cause: error,
    })
  }
  return new PanelError(fallbackMessage, {
    status: 0,
    code: 'NETWORK_ERROR',
    details: error,
    url,
  })
}

/**
 * Whether a value is a plain JSON object. Arrays are excluded on purpose: the core
 * always reports a failure as `{ error: { … } }`, and an array in that position means
 * we are looking at something we do not understand.
 */
export function isPanelRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Turn a failed core response into a `PanelError` that says what the core said.
 *
 * The core answers with `{ error: { code, message } }`, and that message is usually the
 * most useful thing in the failure ("Collection 'x' is not registered"). Preferring it
 * over the status line keeps every SDK surface reading the same way, so a generated
 * panel that mixes `PanelClient` calls with a bare `fetchPanelLocalization()` never
 * shows one message here and a different one there.
 */
export function panelResponseError(
  response: Response,
  payload: unknown,
  raw: string,
  url: string,
  fallbackMessage?: string,
): PanelError {
  const root = isPanelRecord(payload) ? payload : undefined
  const direct = root && isPanelRecord(root.error) ? root.error : undefined
  const nestedData = root && isPanelRecord(root.data) ? root.data : undefined
  const nested = nestedData && isPanelRecord(nestedData.error) ? nestedData.error : undefined
  const error = direct ?? nested
  const message = stringValue(error?.message)
    ?? stringValue(root?.message)
    ?? fallbackMessage
    ?? stringValue(response.statusText)
    ?? `Panel API request failed with HTTP ${response.status}`
  return new PanelError(message, {
    status: response.status,
    code: stringValue(error?.code) ?? `HTTP_${response.status}`,
    details: error ?? payload ?? raw,
    url,
  })
}
