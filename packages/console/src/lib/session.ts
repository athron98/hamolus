import { createSignal } from 'solid-js'
import type { AuthUser, Permission } from '@hamolus/types'
import { api } from './api'

const SESSION_KEY = 'console-session'

interface StoredSession {
  user?: AuthUser | null
  permissions?: Permission[]
}

function loadStored(): StoredSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const obj = parsed as StoredSession
    return {
      user: obj.user && typeof obj.user === 'object' ? (obj.user as AuthUser) : null,
      permissions: Array.isArray(obj.permissions) ? (obj.permissions as Permission[]) : [],
    }
  } catch {
    return {}
  }
}

const stored = loadStored()

const [user, setUser] = createSignal<AuthUser | null>(stored.user ?? null)
const [permissions, setPermissions] = createSignal<Permission[]>(stored.permissions ?? [])

function persist() {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ user: user(), permissions: permissions() } satisfies StoredSession),
    )
  } catch {
    /* ignore */
  }
}

/** Apply a freshly-resolved session (login/setup/me). */
export function applySession(nextUser: AuthUser, nextPermissions: Permission[]): void {
  setUser(nextUser)
  setPermissions(nextPermissions)
  persist()
}

export function clearSession(): void {
  setUser(null)
  setPermissions([])
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function hasPermission(perm: Permission): boolean {
  const p = permissions()
  if (p.includes(perm)) return true
  // Legacy ADMIN_KEY sessions and platform super-admin sessions are implicitly all-access.
  const u = user()
  if (!u) return false
  if (u.id === 'admin' && u.privilegeName === 'admin') return true
  if (u.id.startsWith('super:') && u.privilegeName === 'superadmin') return true
  return false
}

/** Hydrate the session from `/me` (silent; keeps the stored snapshot on failure). */
export async function hydrateSession(): Promise<boolean> {
  try {
    const { data } = await api.me()
    applySession(data.user, data.permissions)
    return true
  } catch {
    return false
  }
}

export { user, permissions }