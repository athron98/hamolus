/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

/**
 * Console-managed MCP servers.
 *
 * A deployed MCP worker holds exactly two things: the core API URL and an
 * instance id. Everything that decides *what it may do* — which land/colony it
 * sees, whether it may write, which tool groups it offers, and who is allowed
 * to call it — is stored in the core and read at request time. That is what
 * makes the console the single place an operator touches.
 *
 * The load-bearing export here is {@link MCP_GROUP_PERMISSIONS}. It converts an
 * operator's *declared* blast radius (tool groups) into the *enforced* one (a
 * permission list the core itself checks). Without it a read-only instance is a
 * promise made by the worker rather than a rule the core applies.
 */

import { z } from 'zod'
import type { Permission } from './auth'
import { PERMISSIONS } from './auth'
import { isColonyId, isLandId } from './scope'

/** Tool groups a deployment can offer; see `packages/mcp/src/tools/index.ts` for the members. */
export const MCP_TOOL_GROUPS = ['records', 'media', 'meta', 'admin'] as const
export type McpToolGroup = (typeof MCP_TOOL_GROUPS)[number]

/** Groups an instance gets when the operator picks none. `admin` is opt-in. */
export const DEFAULT_MCP_TOOL_GROUPS: readonly McpToolGroup[] = ['records', 'media', 'meta']

/**
 * What each group actually costs, taken from the ACL of the routes it calls —
 * not from the tool names.
 *
 * - `records` holds `users.*` because its record tools are generic: `create_record`
 *   takes any collection name, and `writePerm` in the core maps the protected
 *   `users` collection to `users.write`. Granting this group can reach user
 *   records, which is exactly the blast radius it is meant to represent.
 * - `meta` holds `config.*` and `collections.*` because it ships `put_config`,
 *   `put_group` and `update_settings` alongside the read tools.
 * - `admin` holds `settings.write` for the scope export/import seed routes.
 */
export const MCP_GROUP_PERMISSIONS: Record<McpToolGroup, { read: Permission[]; write: Permission[] }> = {
  records: {
    read: ['records.read', 'collections.read', 'users.read'],
    write: ['records.write', 'collections.write', 'users.write'],
  },
  media: {
    read: ['media.read'],
    write: ['media.write'],
  },
  meta: {
    read: ['settings.read', 'config.read', 'collections.read', 'lands.read', 'colonies.read'],
    write: ['settings.write', 'config.write', 'collections.write'],
  },
  admin: {
    read: ['users.read', 'collections.read', 'lands.read', 'colonies.read'],
    write: ['users.write', 'collections.write', 'lands.write', 'colonies.write', 'settings.write'],
  },
}

/**
 * The permission set an instance's session JWT carries.
 *
 * `readonly` drops every `*.write`, which is what turns the console's read/write
 * toggle into a `403` from the core rather than a missing tool on the worker.
 * Unknown group names are dropped, so a value written by a newer console degrades
 * to a smaller surface instead of an instance that authorizes nothing.
 */
export function mcpPermissions(input: {
  toolGroups: readonly string[]
  readonly?: boolean
}): Permission[] {
  const out = new Set<Permission>()
  for (const name of input.toolGroups) {
    const group = MCP_GROUP_PERMISSIONS[name as McpToolGroup]
    if (!group) continue
    for (const perm of group.read) out.add(perm)
    if (!input.readonly) for (const perm of group.write) out.add(perm)
  }
  return [...out].filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p))
}

/** `"all"` or a comma-separated subset; unknown names dropped, order preserved. */
export function parseMcpToolGroups(raw: string | undefined | null): McpToolGroup[] {
  if (!raw || raw.trim() === '') return [...DEFAULT_MCP_TOOL_GROUPS]
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  if (parts.includes('all')) return [...MCP_TOOL_GROUPS]
  const seen = new Set<McpToolGroup>()
  for (const part of parts) {
    if ((MCP_TOOL_GROUPS as readonly string[]).includes(part)) seen.add(part as McpToolGroup)
  }
  return [...seen]
}

export function formatMcpToolGroups(groups: readonly string[]): string {
  return groups.filter((g) => (MCP_TOOL_GROUPS as readonly string[]).includes(g)).join(',')
}

/** A scope-pinned id. Every MCP row is addressed by the colony it serves. */
const landSchema = z.string().trim().min(1).refine(isLandId, 'Land must be a name ending in "_lnd"')
const colonySchema = z
  .string()
  .trim()
  .min(1)
  .refine(isColonyId, 'Colony must be a name ending in "_cny"')

/**
 * The instance id *is* the worker's credential, so it has to be unguessable:
 * `mcp_` plus 26 base62 characters is about 155 bits. It is not a secret in the
 * sense of being confidential — it can only read a tool-surface description —
 * but it must not be guessable, because guessing it is the same as being it.
 */
export const MCP_INSTANCE_ID_PATTERN = /^mcp_[0-9A-Za-z]{26}$/

/** `hmcp_<id>_<secret>`; the id indexes the row, the secret is only ever stored hashed. */
export const MCP_TOKEN_PATTERN = /^hmcp_([0-9A-Za-z]{12})_([0-9A-Za-z_-]{43})$/

/**
 * The header a deployed MCP worker sends to say which release it is running.
 *
 * Lives in the shared contract rather than being spelled out in both packages because
 * it has to be the *same string* on both sides: the core stores whatever arrives under
 * it and the console renders it, so a typo here is not a compile error anywhere — it
 * is a column that silently stays `null` forever while every deployment reports in
 * good faith.
 *
 * Additive on purpose. An older worker that never sends it still gets served; it just
 * records liveness without a version, which is the honest answer rather than a
 * missing feature.
 */
export const MCP_WORKER_VERSION_HEADER = 'x-hamolus-mcp-version'

/** What the worker reads on every request to decide what it may offer. */
export const mcpInstanceConfigSchema = z
  .object({
    id: z.string().regex(MCP_INSTANCE_ID_PATTERN, 'Invalid instance id'),
    label: z.string().trim().min(1).max(80),
    land: landSchema,
    colony: colonySchema,
    enabled: z.boolean(),
    readonly: z.boolean(),
    toolGroups: z.array(z.enum(MCP_TOOL_GROUPS)).min(1, 'Pick at least one tool group'),
    dynamicTools: z.string().trim().max(500),
    dynamicMax: z.number().int().min(1).max(100),
  })
  .strict()

export type McpInstanceConfig = z.infer<typeof mcpInstanceConfigSchema>

/** The operator-facing row. The instance id is visible; the token secret never is. */
export interface McpInstance {
  id: string
  land: string
  colony: string
  label: string
  enabled: boolean
  readonly: boolean
  toolGroups: McpToolGroup[]
  dynamicTools: string
  dynamicMax: number
  tokenCount: number
  activeTokenCount: number
  /**
   * The version the *deployed worker* reported on its last call, or `null` if it has
   * never called.
   *
   * Server-owned, never operator-supplied: nothing in `mcpInstanceCreateSchema` or
   * `mcpInstanceUpdateSchema` writes it, because the only party that knows which
   * release is deployed is the deployment itself. A worker predating this field simply
   * stops reporting and the row keeps whatever it last said — which is the point, since
   * "unknown" and "reporting 0.2.9" are different answers and only one of them is
   * evidence.
   */
  reportedVersion: string | null
  /**
   * When the worker last reached this core, or `null` if it never has.
   *
   * This is what turns an `enabled` row into a live one. `enabled` is a switch an
   * operator flipped; it stays true forever whether or not anything is deployed behind
   * it, so a row with no `lastSeenAt` is a credential with no server rather than a
   * server with a problem.
   */
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * `land` and `colony` are deliberately *absent* here.
 *
 * An instance belongs to exactly one colony, and the operator route resolves that
 * colony from `?land=`/`?colony=` plus the session's own privilege — the same way
 * `/_config` does it. Accepting them in the body as well would give the same fact
 * two sources, and a caller that sent one in the body and another in the query would
 * get whichever the route happened to read. Scope in the body is a *request*; scope
 * in the query is also a request; neither is a grant, and the route decides.
 *
 * They stay in the response, because the console has to show which colony a row
 * belongs to and a land admin needs to see the scope it was created under.
 */
export const mcpInstanceCreateSchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(80),
    enabled: z.boolean().optional(),
    readonly: z.boolean().optional(),
    toolGroups: z.array(z.enum(MCP_TOOL_GROUPS)).min(1, 'Pick at least one tool group').optional(),
    dynamicTools: z.string().trim().max(500).optional(),
    dynamicMax: z.number().int().min(1).max(100).optional(),
  })
  .strict()

export type McpInstanceCreateInput = z.infer<typeof mcpInstanceCreateSchema>

export const mcpInstanceUpdateSchema = mcpInstanceCreateSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Nothing to update',
)

export type McpInstanceUpdateInput = z.infer<typeof mcpInstanceUpdateSchema>

/**
 * `permissions` narrows the instance; it can never widen it. A token that names
 * `records.read` alone turns a read-write instance into a read-only one for that
 * caller without touching the instance everyone else shares.
 */
export const mcpTokenCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    permissions: z.array(z.enum(PERMISSIONS)).optional(),
    expiresAt: z.string().trim().min(1).max(40).nullable().optional(),
  })
  .strict()

export type McpTokenCreateInput = z.infer<typeof mcpTokenCreateSchema>

export interface McpToken {
  id: string
  instanceId: string
  land: string
  colony: string
  name: string
  permissions: Permission[] | null
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

/** Returned once, at creation, because the plaintext is not recoverable afterwards. */
export interface McpTokenCreated extends McpToken {
  token: string
}

/** Body of `POST /_mcp/session` — the worker proves the caller, the core does the minting. */
export const mcpSessionExchangeSchema = z
  .object({
    token: z.string().trim().min(1, 'Token is required').max(200),
  })
  .strict()

export type McpSessionExchangeInput = z.infer<typeof mcpSessionExchangeSchema>

/**
 * `?land=` / `?colony=`, same reading as `/_config`: a request, never a grant.
 * A land admin has to name the colony they mean.
 */
export const mcpListQuerySchema = z
  .object({ land: landSchema.optional(), colony: colonySchema.optional() })
  .strict()

export type McpListQuery = z.infer<typeof mcpListQuerySchema>
