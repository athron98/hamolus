/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { isColonyId, isLandId } from './scope'
import type { PrivilegeScope } from './scope'
import { z } from 'zod'

/** Every capability the console/core understand (translated directly into role seeds). */
export const PERMISSIONS = [
  'users.read',
  'users.write',
  'config.read',
  'config.write',
  'settings.read',
  'settings.write',
  'collections.read',
  'collections.write',
  'records.read',
  'records.write',
  'media.read',
  'media.write',
  'panels.read',
  'panels.write',
  'lands.read',
  'lands.write',
  'colonies.read',
  'colonies.write',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/** One privilege (role) record — mirrors the `privileges` collection row. */
export interface Privilege {
  name: string
  label: string
  description?: string
  /**
   * How far this privilege reaches. `universe` spans every land and colony,
   * `land` spans the land it owns plus that land's colonies, `colony` is
   * confined to a single colony.
   */
  scope: PrivilegeScope
  permissions: Permission[]
  isSystem?: boolean
}

/**
 * Default privileges seeded into each scope's `privileges` collection the first
 * time that scope is used. `settings.read` is granted to every role because the
 * console loads `localization.languages` from settings to render localized forms.
 *
 * Scope ladder: `land_admin` → land, every other role → colony. The `universe`
 * scope is NOT seeded here — it is held by the platform-wide `_auth_super`
 * accounts, so no scope-privileged role can be handed out from inside a land.
 */
export const PRIVILEGE_SEEDS: Privilege[] = [
  {
    name: 'land_admin',
    label: 'Land Admin',
    description: 'Owns one land and every colony inside it, including their users.',
    scope: 'land',
    // Reads the registry and manages the colonies of the owned land, but never
    // creates or deletes lands themselves (that is the superadmin's job).
    permissions: PERMISSIONS.filter((p) => p !== 'lands.write'),
    isSystem: true,
  },
  {
    name: 'admin',
    label: 'Administrator',
    description: 'Full access to every console and API capability inside one colony.',
    scope: 'colony',
    permissions: PERMISSIONS.filter((p) => !p.startsWith('lands.') && !p.startsWith('colonies.')),
    isSystem: true,
  },
  {
    name: 'manager',
    label: 'Manager',
    description: 'Everything except user management, configuration and scope administration.',
    scope: 'colony',
    permissions: [
      ...PERMISSIONS.filter(
        (p) =>
          ![
            'users.write',
            'config.write',
            'lands.read',
            'lands.write',
            'colonies.read',
            'colonies.write',
          ].includes(p),
      ),
    ],
    isSystem: true,
  },
  {
    name: 'editor',
    label: 'Editor',
    description: 'Create and edit content records and media.',
    scope: 'colony',
    permissions: [
      'settings.read',
      'collections.read',
      'records.read',
      'records.write',
      'media.read',
      'media.write',
    ],
    isSystem: true,
  },
  {
    name: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to records, media and settings.',
    scope: 'colony',
    permissions: [
      ...PERMISSIONS.filter((p) => p.endsWith('.read') && !p.startsWith('lands.') && !p.startsWith('panels.')),
    ],
    isSystem: true,
  },
  {
    name: 'panel_user',
    label: 'Panel user',
    description: 'Access limited to assigned panels',
    scope: 'colony',
    permissions: [],
    isSystem: true,
  },
]

/** A managed user in one scope's builtin `users` collection. */
export interface AuthUser {
  id: string
  /** Land the account's scope belongs to (`root_lnd` until the land is named). */
  land: string
  /** Colony the account is confined to (`root_cny` until the colony is named). */
  colony: string
  username: string
  name: string | null
  /** `privileges.id` the user belongs to. */
  privilegeId: string
  /** Privilege name (slug) resolved at read time. */
  privilegeName: string | null
  /** Privilege label resolved at read time. */
  privilegeLabel: string | null
  /** How far this user's privilege reaches. */
  privilegeScope: PrivilegeScope | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Claims embedded in the issued JWT (kept small; permissions resolve from the privilege). */
export interface AuthTokenPayload {
  /** User id (or the literal `admin` for legacy ADMIN_KEY logins). */
  sub: string
  username?: string
  /** Privilege name at issue time. */
  role?: string
  /** Privilege scope at issue time. */
  scope?: PrivilegeScope
  /** Full permission list at issue time (legacy ADMIN_KEY tokens get everything). */
  permissions?: Permission[]
  /** Land this token belongs to (absent = platform-scoped, e.g. ADMIN_KEY). */
  land?: string
  /** Colony this token is confined to. */
  colony?: string
  iat?: number
  exp?: number
}

/** Session payload returned by login/setup/me. */
export interface AuthSession {
  user: AuthUser
  permissions: Permission[]
}

const usernamePattern = /^[a-z][a-z0-9_]*$/

export const authSetupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, 'Username must be at least 2 characters')
      .max(40)
      .regex(usernamePattern, 'Username must be lowercase letters, numbers and underscores'),
    name: z.string().trim().min(1, 'Name is required').max(80),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  })
  .strict()

export type AuthSetupInput = z.infer<typeof authSetupSchema>

export const authLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(128),
  })
  .strict()

export type AuthLoginInput = z.infer<typeof authLoginSchema>

export const authUserCreateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, 'Username must be at least 2 characters')
      .max(40)
      .regex(usernamePattern, 'Username must be lowercase letters, numbers and underscores'),
    name: z.string().trim().min(1, 'Name is required').max(80),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    privilegeId: z.string().min(1, 'Privilege is required'),
    isActive: z.boolean().optional(),
  })
  .strict()

export type AuthUserCreateInput = z.infer<typeof authUserCreateSchema>

export const authUserUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
    privilegeId: z.string().min(1, 'Privilege is required').optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export type AuthUserUpdateInput = z.infer<typeof authUserUpdateSchema>

/** Self-service password change: the signed-in user verifies their current password first. */
export const authChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
  })
  .strict()

export type AuthChangePasswordInput = z.infer<typeof authChangePasswordSchema>

/**
 * A platform-wide super administrator: a global account OUTSIDE every scope's
 * `users` collection, held in the internal `_auth_super` table. Its scope is
 * `universe` — it can manage the land/colony registry and every scope's data,
 * and its credentials survive even if every land is deleted. Usernames are
 * unique across the whole platform.
 */
export interface SuperAdminUser {
  id: string
  username: string
  name: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const superAdminCreateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, 'Username must be at least 2 characters')
      .max(40)
      .regex(usernamePattern, 'Username must be lowercase letters, numbers and underscores'),
    name: z.string().trim().min(1, 'Name is required').max(80),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  })
  .strict()

export type SuperAdminCreateInput = z.infer<typeof superAdminCreateSchema>

export const superAdminUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export type SuperAdminUpdateInput = z.infer<typeof superAdminUpdateSchema>

/**
 * A key/value configuration entry stored in the internal `_configs` table.
 *
 * An entry belongs to exactly one land and one colony — there is no separate
 * classification column. Which colony it is *is* the scope, so a land-level user
 * edits their colonies and a colony-level user never sees another one.
 */
export interface ConfigEntry {
  key: string
  /** Arbitrary JSON value. */
  value: unknown
  land: string
  colony: string
  description?: string | null
  updatedAt: string
}

export const configEntrySchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'Key is required')
      .max(100)
      .regex(/^[a-z][a-z0-9._-]*$/, 'Key must start with a letter and use lowercase, digits, dots, dashes or underscores'),
    value: z.unknown(),
    description: z.string().trim().max(255).nullable().optional(),
  })
  .strict()

export type ConfigEntryInput = z.infer<typeof configEntrySchema>

/**
 * `?land=` widens a read to every colony of that land; `?colony=` narrows it to one.
 * Both are optional and both are checked against the caller's access by the core, so
 * a query is a request, not a grant. Omitting them means "whatever this session may
 * see", which is not the same thing as "everything" for a pinned session.
 */
export const configListQuerySchema = z
  .object({
    land: z
      .string()
      .trim()
      .min(1)
      .refine(isLandId, 'Land must be a name ending in "_lnd" (or "root_lnd")')
      .optional(),
    colony: z
      .string()
      .trim()
      .min(1)
      .refine(isColonyId, 'Colony must be a name ending in "_cny" (or "root_cny")')
      .optional(),
  })
  .strict()

export type ConfigListQuery = z.infer<typeof configListQuerySchema>