import type { KvClient, PluginKvEntry } from '../plugins/types'
import { apiBase, colony, land, token } from './store'

function authHeaders(): Record<string, string> {
  const t = token()
  const c = colony()
  const l = land()
  return {
    'content-type': 'application/json',
    ...(t ? { authorization: `Bearer ${t}` } : {}),
    ...(c ? { 'x-colony': c } : {}),
    ...(l ? { 'x-land': l } : {}),
  }
}

async function unwrap(res: Response): Promise<unknown> {
  if (!res.ok) {
    throw new Error(`Plugin request failed (HTTP ${res.status})`)
  }
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null
  return body?.data ?? null
}

/**
 * Thin fetch adapter over the core's `/api/_plugins/:plugin` routes. The client
 * captures the plugin id once but reads `apiBase()`/`token()`/`colony()` at every
 * call, so an endpoint switch mid-session keeps working.
 */
export function createPluginKv(pluginId: string): KvClient {
  const base = () => `${apiBase()}/_plugins/${encodeURIComponent(pluginId)}`
  return {
    async list(): Promise<PluginKvEntry[]> {
      const data = await unwrap(await fetch(base(), { headers: authHeaders() }))
      return Array.isArray(data) ? (data as PluginKvEntry[]) : []
    },
    async get<T = unknown>(key: string): Promise<T | null> {
      const url = `${base()}/${encodeURIComponent(key)}`
      const res = await fetch(url, { headers: authHeaders() })
      if (res.status === 404) return null
      const data = await unwrap(res)
      return data as T | null
    },
    async set(key: string, value: unknown): Promise<void> {
      const url = `${base()}/${encodeURIComponent(key)}`
      await unwrap(
        await fetch(url, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(value) }),
      )
    },
    async del(key: string): Promise<void> {
      const url = `${base()}/${encodeURIComponent(key)}`
      const res = await fetch(url, { method: 'DELETE', headers: authHeaders() })
      if (!res.ok) throw new Error(`Plugin request failed (HTTP ${res.status})`)
    },
  }
}