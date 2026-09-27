/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import type { Env } from './env'

const globalStore = globalThis as {
  __mcpTokenCache?: Map<string, { at: number; token: string }>
} & typeof globalThis

export class CoreError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message)
    this.name = 'CoreError'
  }
}

export interface ScopeOpt {
  land?: string
  colony?: string
}

/** Thin JSON client for the core API (`/api/*`, Bearer JWT + optional x-land/x-colony). */
export class CoreClient {
  private readonly base: string

  constructor(private readonly env: Env) {
    this.base = (env.CORE_API_URL ?? 'http://localhost:8787/api').replace(/\/+$/, '')
  }

  get readonly(): boolean {
    return this.env.MCP_READONLY === 'true'
  }

  assertWritable(): void {
    if (this.readonly) {
      throw new CoreError('This MCP server is read-only (MCP_READONLY=true). Write tools are disabled.')
    }
  }

  private async token(): Promise<string> {
    const { CORE_API_TOKEN, CORE_ADMIN_KEY } = this.env
    if (CORE_API_TOKEN) return CORE_API_TOKEN
    if (!CORE_ADMIN_KEY) {
      throw new CoreError('No CORE_API_TOKEN or CORE_ADMIN_KEY configured for the MCP server.')
    }
    const cacheKey = `${this.base}|${CORE_ADMIN_KEY}`
    const cache = (globalStore.__mcpTokenCache ??= new Map())
    const hit = cache.get(cacheKey)
    if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.token
    const res = await fetch(`${this.base}/_auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: CORE_ADMIN_KEY }),
    })
    const raw: unknown = await res.json().catch(() => null)
    const body = raw as { data?: { token?: string; error?: { message?: string } }; error?: { message?: string } } | null
    if (!res.ok || !body?.data?.token) {
      const why = body?.error?.message ?? body?.data?.error?.message ?? 'unknown error'
      throw new CoreError(`Failed to mint core token (${res.status}): ${why}`, res.status)
    }
    cache.set(cacheKey, { at: Date.now(), token: body.data.token })
    return body.data.token
  }

  private async request<T>(path: string, init: RequestInit, scope: ScopeOpt = {}): Promise<T> {
    const token = await this.token()
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${token}`)
    const land = scope.land !== undefined ? scope.land : (this.env.CORE_LAND ?? '')
    const colony = scope.colony !== undefined ? scope.colony : (this.env.CORE_COLONY ?? '')
    if (land) headers.set('x-land', land)
    if (colony) headers.set('x-colony', colony)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    const res = await fetch(this.base + path, { ...init, headers })
    const raw = await res.text()
    if (!res.ok) {
      let msg = `Core ${init.method ?? 'GET'} ${path} -> ${res.status}`
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } }
        if (j?.error?.message) msg += `: ${j.error.message}`
      } catch {
        /* keep status line */
      }
      throw new CoreError(msg, res.status)
    }
    if (!raw) return null as unknown as T
    return JSON.parse(raw) as T
  }

  get<T>(path: string, q?: Record<string, string | number | boolean | undefined | null>, scope?: ScopeOpt): Promise<T> {
    return this.request<T>(path + toQuery(q), { method: 'GET' }, scope)
  }

  post<T>(path: string, body: unknown, scope?: ScopeOpt): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) }, scope)
  }

  put<T>(path: string, body: unknown, scope?: ScopeOpt): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, scope)
  }

  delete<T>(path: string, scope?: ScopeOpt): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' }, scope)
  }
}

function toQuery(q?: Record<string, string | number | boolean | undefined | null>): string {
  if (!q) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}