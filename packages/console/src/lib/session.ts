/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

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

/**
 * Whether `/me` has confirmed the stored snapshot at least once.
 *
 * The token and the session snapshot live in two different localStorage keys, so they can
 * disagree — a hand-swapped token, a half-finished login, two tabs. A permission check
 * against a *stale* snapshot is the dangerous direction: it reports a right the current
 * token does not have, and the request it authorises comes back 403. Anything gated on a
 * permission should therefore wait for this instead of trusting `user() !== null`.
 */
const [hydrated, setHydrated] = createSignal(false)

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
  setHydrated(true)
  persist()
}

export function clearSession(): void {
  setUser(null)
  setPermissions([])
  setHydrated(false)
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
    // A failed `/me` is not proof of a bad session: the core can be briefly unreachable
    // while the stored snapshot is still the best answer available. Mark it settled so
    // permission-gated queries run against that snapshot instead of hanging forever.
    setHydrated(true)
    return false
  }
}

export { user, permissions, hydrated }