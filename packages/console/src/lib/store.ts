import { createEffect, createMemo, createSignal, on } from 'solid-js'

export interface ConsoleEndpoint {
  url: string
  label: string
  /** Optional land scope. Sent as `x-land` (tooling/land-admin) or skipped. */
  land?: string
  /** Optional colony scope, sent as `x-colony` on every request. */
  colony?: string
}

const DEFAULT_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

const ENDPOINTS_KEY = 'console-endpoints'
const ACTIVE_KEY = 'console-active-endpoint'
const LEGACY_TOKEN_KEY = 'console_token'
const TOKEN_PREFIX = 'console-token:'

function tokenKey(url: string): string {
  return `${TOKEN_PREFIX}${url}`
}

/** Normalize a user-provided endpoint base URL. */
export function normalizeEndpoint(raw: string): string {
  let url = raw.trim()
  if (!url) return DEFAULT_BASE
  url = url.replace(/\/+$/, '')
  if (url === '/') return DEFAULT_BASE
  if (url.startsWith('/')) return url
  try {
    const u = new URL(url)
    if (u.pathname === '' || u.pathname === '/') u.pathname = '/api'
    url = u.toString().replace(/\/+$/, '')
  } catch {
    /* keep as typed */
  }
  return url
}

function endpointLabel(url: string): string {
  if (url === DEFAULT_BASE) return 'Default'
  try {
    const u = new URL(url)
    return u.host + (u.pathname !== '/api' ? u.pathname : '')
  } catch {
    return url
  }
}

function loadEndpoints(): ConsoleEndpoint[] {
  try {
    const raw = localStorage.getItem(ENDPOINTS_KEY)
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_TOKEN_KEY)
      if (legacy) {
        localStorage.setItem(tokenKey(DEFAULT_BASE), legacy)
        localStorage.removeItem(LEGACY_TOKEN_KEY)
      }
      return [{ url: DEFAULT_BASE, label: 'Default' }]
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('bad shape')
    const list = (parsed as Array<{
      url?: unknown
      label?: unknown
      land?: unknown
      colony?: unknown
    }>)
      .filter((e) => e && typeof e.url === 'string' && e.url)
      .map((e) => ({
        url: e.url as string,
        label: typeof e.label === 'string' && e.label ? e.label : endpointLabel(e.url as string),
        ...(typeof e.land === 'string' && e.land.trim() ? { land: e.land.trim() } : {}),
        ...(typeof e.colony === 'string' && e.colony.trim() ? { colony: e.colony.trim() } : {}),
      }))
    if (list.length === 0) return [{ url: DEFAULT_BASE, label: 'Default' }]
    return list
  } catch {
    return [{ url: DEFAULT_BASE, label: 'Default' }]
  }
}

const [endpoints, setEndpoints] = createSignal<ConsoleEndpoint[]>(loadEndpoints())

function loadActive(rawList: ConsoleEndpoint[]): string {
  try {
    const a = localStorage.getItem(ACTIVE_KEY)
    if (a && rawList.some((e) => e.url === a)) return a
  } catch {
    /* ignore */
  }
  return rawList[0].url
}

const [activeUrl, setActiveUrl] = createSignal<string>(loadActive(endpoints()))

createEffect(() => {
  try {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify(endpoints()))
    localStorage.setItem(ACTIVE_KEY, activeUrl())
  } catch {
    /* ignore */
  }
})

/** Base URL of the active endpoint — reactive, call at request time. */
export const apiBase = createMemo<string>(() => {
  const url = activeUrl()
  return endpoints().find((e) => e.url === url)?.url ?? DEFAULT_BASE
})

/** Active endpoint metadata (label) — for the UI switcher. */
export const activeEndpoint = createMemo<ConsoleEndpoint | undefined>(() =>
  endpoints().find((e) => e.url === activeUrl()),
)

/** Land scope for the active endpoint, '' = the core's default land. */
export const land = createMemo<string>(() => activeEndpoint()?.land ?? '')

/** Colony scope for the active endpoint — sent as `x-colony`, '' = default colony. */
export const colony = createMemo<string>(() => activeEndpoint()?.colony ?? '')

function readToken(url: string): string | null {
  try {
    return localStorage.getItem(tokenKey(url))
  } catch {
    return null
  }
}

/** Token for the active endpoint (JWT — per-endpoint, since each core signs its own). */
const [token, setToken] = createSignal<string | null>(readToken(activeUrl()))

createEffect(on(activeUrl, (url) => setToken(readToken(url))))

export { token }

export function storeToken(value: string | null): void {
  const url = activeUrl()
  try {
    if (value) localStorage.setItem(tokenKey(url), value)
    else localStorage.removeItem(tokenKey(url))
  } catch {
    /* ignore */
  }
  setToken(value)
}

export function setEndpoint(url: string): void {
  if (endpoints().some((e) => e.url === url)) setActiveUrl(url)
}

export function addEndpoint(
  raw: string,
  label?: string,
  landValue?: string,
  colonyValue?: string,
): void {
  const url = normalizeEndpoint(raw)
  const name = label?.trim()
  const trimmed = landValue?.trim()
  const colonyTrimmed = colonyValue?.trim()
  setEndpoints((prev) =>
    prev.some((e) => e.url === url)
      ? prev.map((e) =>
          e.url === url
            ? {
                url: e.url,
                label: name || e.label,
                ...(trimmed ? { land: trimmed } : e.land ? { land: e.land } : {}),
                ...(colonyTrimmed
                  ? { colony: colonyTrimmed }
                  : e.colony
                    ? { colony: e.colony }
                    : {}),
              }
            : e,
        )
      : [
          ...prev,
          {
            url,
            label: name || endpointLabel(url),
            ...(trimmed ? { land: trimmed } : {}),
            ...(colonyTrimmed ? { colony: colonyTrimmed } : {}),
          },
        ],
  )
  setActiveUrl(url)
}

export function renameEndpoint(url: string, label: string): void {
  const name = label.trim()
  if (!name) return
  setEndpoints((prev) => prev.map((e) => (e.url === url ? { ...e, label: name } : e)))
}

function clearTokenFor(url: string): void {
  try {
    localStorage.removeItem(tokenKey(url))
  } catch {
    /* ignore */
  }
}

export function removeEndpoint(url: string): void {
  clearTokenFor(url)
  const list = endpoints()
  if (list.length <= 1) return
  const next = list.filter((e) => e.url !== url)
  setEndpoints(next)
  if (activeUrl() === url) {
    const first = next[0]?.url ?? DEFAULT_BASE
    setActiveUrl(first)
    setToken(readToken(first))
  }
}

export { endpoints, activeUrl }