/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { z } from 'zod'

/** How a core worker behaves. `independent` = single scope (land/colony layer off). */
export const CORE_MODES = ['independent', 'centralized', 'proxy', 'bridge'] as const
export type CoreMode = (typeof CORE_MODES)[number]

/** Suffixes appended to a user-chosen scope name to form its id. */
export const LAND_SUFFIX = '_lnd'
export const COLONY_SUFFIX = '_cny'

/**
 * Root scope ids. A land or colony that has not been given a name yet is
 * `root` — activating one requires a real name (see `landIdFor`/`colonyIdFor`).
 * A request that carries no scope headers always lands here.
 */
export const LAND_ROOT = `root${LAND_SUFFIX}`
export const COLONY_ROOT = `root${COLONY_SUFFIX}`

/** The implicit default scope: `root_lnd` / `root_cny`. */
export const LAND_DEFAULT = LAND_ROOT
export const COLONY_DEFAULT = COLONY_ROOT

/** The `__` separator between scope ids in a physical table name. */
export const TABLE_SEP = '__'

/** A scope name as typed by a user, before its suffix is applied. */
const scopeNamePattern = /^[a-z][a-z0-9_]{0,39}$/
const RESERVED_NAMES = new Set(['root', 'default'])

export const scopeNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Name must be at least 2 characters')
  .max(40, 'Name must be at most 40 characters')
  .regex(scopeNamePattern, 'Name must use lowercase letters, numbers and underscores')
  .refine(
    (v) => !RESERVED_NAMES.has(v),
    '"root" is reserved for the unnamed scope — choose another name',
  )
  .refine((v) => !v.includes(TABLE_SEP), 'Name cannot contain a double underscore')

export type ScopeNameInput = z.infer<typeof scopeNameSchema>

/** Strip a trailing suffix so `acme_lnd` and `acme` both normalize to `acme`. */
function baseName(raw: string, suffix: string): string {
  return raw.toLowerCase().trim().endsWith(suffix)
    ? raw.toLowerCase().trim().slice(0, -suffix.length)
    : raw.toLowerCase().trim()
}

/** `{name}_lnd` for a user-supplied name, or `null` when the name is unusable. */
export function landIdFor(name: string): string | null {
  const parsed = scopeNameSchema.safeParse(baseName(name, LAND_SUFFIX))
  return parsed.success ? `${parsed.data}${LAND_SUFFIX}` : null
}

/** `{name}_cny` for a user-supplied name, or `null` when the name is unusable. */
export function colonyIdFor(name: string): string | null {
  const parsed = scopeNameSchema.safeParse(baseName(name, COLONY_SUFFIX))
  return parsed.success ? `${parsed.data}${COLONY_SUFFIX}` : null
}

/**
 * Normalize a land id from an untrusted source (env var, header, registry row):
 * `''` → `root_lnd`, `acme` → `acme_lnd`, `acme_lnd` → `acme_lnd`.
 */
export function normalizeLandId(raw: string | undefined | null): string {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || v === 'default') return LAND_ROOT
  return v.endsWith(LAND_SUFFIX) ? v : `${v}${LAND_SUFFIX}`
}

/** Colony counterpart of `normalizeLandId`. */
export function normalizeColonyId(raw: string | undefined | null): string {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v || v === 'default') return COLONY_ROOT
  return v.endsWith(COLONY_SUFFIX) ? v : `${v}${COLONY_SUFFIX}`
}

/** True when the id is the unnamed (root) land. */
export function isRootLand(id: string): boolean {
  return normalizeLandId(id) === LAND_ROOT
}

/** True when the id is the unnamed (root) colony. */
export function isRootColony(id: string): boolean {
  return normalizeColonyId(id) === COLONY_ROOT
}

/** The user-facing name behind a land id (`acme_lnd` → `acme`, `root_lnd` → `root`). */
export function landBaseName(id: string): string {
  return baseName(id, LAND_SUFFIX)
}

/** The user-facing name behind a colony id (`acme_cny` → `acme`). */
export function colonyBaseName(id: string): string {
  return baseName(id, COLONY_SUFFIX)
}

/**
 * The default scope for an env: a bare name or a full id on either axis.
 * With neither set the request lands on `root_lnd` / `root_cny`.
 */
export function defaultScopeIds(env: { DEFAULT_LAND?: string; DEFAULT_COLONY?: string }): {
  land: string
  colony: string
} {
  return {
    land: normalizeLandId(env.DEFAULT_LAND),
    colony: normalizeColonyId(env.DEFAULT_COLONY),
  }
}

const landIdPattern = /^root_lnd$|^[a-z][a-z0-9_]*_lnd$/
const colonyIdPattern = /^root_cny$|^[a-z][a-z0-9_]*_cny$/

export function isLandId(value: string): boolean {
  return landIdPattern.test(value) && !value.includes(TABLE_SEP)
}

export function isColonyId(value: string): boolean {
  return colonyIdPattern.test(value) && !value.includes(TABLE_SEP)
}

/**
 * How far a privilege reaches. `universe` sees every land and colony,
 * `land` sees the land it owns plus that land's colonies, `colony` sees only
 * its own colony.
 */
export const PRIVILEGE_SCOPES = ['universe', 'land', 'colony'] as const
export type PrivilegeScope = (typeof PRIVILEGE_SCOPES)[number]

/** A land owns colonies and a platform-wide data namespace of its own. */
export interface LandDto {
  id: string
  label: string
  description?: string | null
  /** User id of the landadmin who owns this land; `null` while unclaimed. */
  ownerUserId: string | null
  createdAt: string
  updatedAt: string
}

export const landDefinitionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(2, 'Land id must be at least 2 characters')
      .max(40)
      .regex(landIdPattern, 'Land id must be a lowercase name ending in "_lnd" (or the reserved "root_lnd")')
      .refine(isLandId, 'Land id is not a valid land id'),
    label: z.string().trim().min(1, 'Label is required').max(80),
    description: z.string().trim().max(255).nullable().optional(),
    ownerUserId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict()

export type LandDefinitionInput = z.infer<typeof landDefinitionSchema>

/** A colony is a full data namespace nested inside a land. */
export interface ColonyDto {
  id: string
  landId: string
  label: string
  description?: string | null
  /** User id of the landadmin who owns this colony; `null` while unclaimed. */
  ownerUserId: string | null
  createdAt: string
  updatedAt: string
}

export const colonyDefinitionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(2, 'Colony id must be at least 2 characters')
      .max(40)
      .regex(colonyIdPattern, 'Colony id must be a lowercase name ending in "_cny" (or the reserved "root_cny")')
      .refine(isColonyId, 'Colony id is not a valid colony id'),
    label: z.string().trim().min(1, 'Label is required').max(80),
    description: z.string().trim().max(255).nullable().optional(),
    ownerUserId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict()

export type ColonyDefinitionInput = z.infer<typeof colonyDefinitionSchema>

/** A resolved (land, colony) pair — the unit of isolation. */
export interface ScopeIds {
  land: string
  colony: string
}
