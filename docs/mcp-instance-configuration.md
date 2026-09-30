# MCP instance configuration

A deployment of `@hamolus/mcp` should need exactly two things to talk to a core:
the core's API URL and an **instance id**. Everything else — which tools it
offers, whether it may write, which land/colony it sees, and who is allowed to
call it — belongs in the core, configured from the console.

It used to be the other way round. `wrangler.jsonc` carried `CORE_API_URL`,
`CORE_ADMIN_KEY`, `CORE_LAND`, `CORE_COLONY`, `MCP_TOOL_GROUPS`,
`MCP_READONLY`, `MCP_DYNAMIC_TOOLS` and `MCP_BEARER_TOKEN`, and the worker was
effectively an admin-key proxy: whatever it could reach, it could do. This document
records why, and what replaced it.

> **Status: shipped in 0.2.10.** The model below is what runs today. See
> [the MCP server reference](../packages/mcp/docs/mcp.md) for the operating
> instructions — this document is the reasoning and the shape, not the how-to.
>
> The old env path is still honoured, so a deployment can be migrated in place:
> set `MCP_INSTANCE_ID`, confirm `GET /` reports `mode: "console-managed"`, then
> delete the `CORE_ADMIN_KEY` and `MCP_BEARER_TOKEN` secrets. Until then `GET /`
> reports `mode: "legacy"` and warns.

## Where each piece lives

| Concern | Where it is configured |
| --- | --- |
| Which core | `CORE_API_URL`, the worker's var |
| Which instance | `MCP_INSTANCE_ID`, the worker's var — a generated credential, issued by the console |
| Which colony it serves | the instance, in the core — set at creation, never in the worker |
| Enabled / read-only | the instance, in the core — effective within a minute, no redeploy |
| Tool groups, dynamic collections, cap | the instance, in the core |
| Who may see or change any of it | `mcp.read` / `mcp.write` on a console role |
| Who may call this server | a per-user token, issued in the console, revocable on its own |

**Environment → MCP** in the console is the single surface for every row in that
table except the first two.

## The problem with `CORE_ADMIN_KEY`

The admin key is a **platform-wide** credential. Handing it to an MCP worker
means:

- the worker can read and write every land and colony, not one;
- it can create users, lands and colonies, because the key mints a token with
  every permission (`routes/auth.ts:126-141` issues `sub: 'admin'` with no
  permission list, which `sessionPermissions` reads as *all* of `PERMISSIONS`);
- revoking it is a rotation of a shared secret across every deployment;
- nothing ties a request to a person, so an audit log cannot say who wrote.

`MCP_READONLY` and `MCP_TOOL_GROUPS` narrow what the *worker offers*, but the
credential behind them does not narrow what the *core accepts*. The two are
separate controls and only one of them is enforced by the thing that matters.

## Shape of the solution

```
console ──(session JWT, mcp.write)──▶ core ──▶ _mcp_instances / _mcp_tokens
                                          ▲
                                          │  POST /_mcp/session  { token }
                                          │  GET  /_mcp/config
                                   MCP worker
                                          │
                                   AI client ──(per-user token)──▶ POST /mcp
```

Three roles, three credentials:

| Party | Credential | Where it lives |
| ----- | ---------- | -------------- |
| Operator | console session JWT | browser, 24 h |
| MCP worker | instance id | `wrangler.jsonc` var, one per deployment |
| AI client | per-user token | issued in the console, pasted into the client |

The instance id **is** the worker's credential: a high-entropy random string,
unguessable, per deployment, rotatable by re-issuing. That is what keeps the
deploy-time surface at two vars, and it is safe precisely because it can only
read a tool-surface description — it cannot mint a session on its own.

The per-user token is what carries identity. The core exchanges it for a
**short-lived, permission-scoped, land/colony-pinned JWT**, and the worker uses
that JWT for every core call. Read-only and tool-group decisions are therefore
enforced by the core's own `requireRead`/`requireWrite`, not by the worker's
good behaviour.

## Data model

Two internal tables, created at runtime like `_configs` and `_auth_users`
(`packages/core/src/auth/mcp.ts`).

### `_mcp_instances`

One row per deployed MCP server, scoped to the colony it serves.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `land` | TEXT | part of the primary key |
| `colony` | TEXT | part of the primary key; the scope every session from this instance is pinned to |
| `id` | TEXT | the instance id, `mcp_` + 26 base62 chars; part of the primary key |
| `label` | TEXT | operator-facing name |
| `enabled` | INTEGER | `0` ⇒ the worker gets `403 MCP_DISABLED` |
| `readonly` | INTEGER | `1` ⇒ no `*.write` permission is ever minted |
| `tool_groups` | TEXT | comma-separated subset of `records,media,meta,admin`; `all` allowed |
| `dynamic_tools` | TEXT | `all` or a collection list; empty = off |
| `dynamic_max` | INTEGER | cap on generated tools, default 10 |
| `created_at`, `updated_at` | TEXT | |

`PRIMARY KEY (land, colony, id)`.

### `_mcp_tokens`

One row per issued per-user token.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | TEXT | `tok_` + 12 base62 chars; the lookup key, and what the console displays |
| `land`, `colony` | TEXT | copied from the instance, so a token cannot outlive its scope |
| `instance_id` | TEXT | owning instance |
| `name` | TEXT | operator-facing label ("claude desktop — rani") |
| `token_hash` | TEXT | `sha256(secret)` hex — **the secret is never stored** |
| `permissions` | TEXT | JSON array; an optional *narrowing* subset of what the instance grants |
| `expires_at` | TEXT | nullable; `null` = no expiry |
| `revoked_at` | TEXT | nullable; set means dead |
| `last_used_at` | TEXT | nullable, written on each exchange |
| `created_at` | TEXT | |

The token string is `mcp_<id>_<secret>`. Lookup is a primary-key hit on `id`,
then a constant-time compare of `sha256(secret)`. Because the row is state, a
token can be revoked, expired and audited — none of which a stateless JWT can
do. This is the piece that does not exist anywhere in the codebase today
(`routes/auth.ts:60` mints 24 h JWTs and nothing can recall them).

## Permission mapping

The mapping is the whole point: it converts a deployment's *declared* blast
radius into the *enforced* one. It is derived from the routes each group calls,
not from the tool names.

| Group | Read | Write |
| ----- | ---- | ----- |
| `records` | `records.read`, `collections.read`, `users.read` | `records.write`, `collections.write`, `users.write` |
| `media` | `media.read` | `media.write` |
| `meta` | `settings.read`, `config.read`, `collections.read`, `lands.read`, `colonies.read` | `settings.write`, `config.write`, `collections.write` |
| `admin` | `users.read`, `collections.read`, `lands.read`, `colonies.read` | `users.write`, `collections.write`, `lands.write`, `colonies.write`, `settings.write` |

Why these and not fewer:

- `records` needs `users.*` because the record tools are generic
  (`create_record` takes any collection name) and `dynamic.ts:34-36` maps the
  protected `users` collection to `users.write`. An instance granted `records`
  can reach user records. That is the cost of the group, and the reason it is a
  group.
- `meta` needs `config.write` and `collections.write` because it ships
  `put_config`, `delete_config`, `put_group` (`routes/meta.ts:168,183`) and
  `update_settings` (`routes/meta.ts:73`), plus `settings.write` for the plugin
  KV (`routes/plugins.ts:86,98`).
- `admin` needs `settings.write` for `export_scope`/`import_scope`
  (`routes/seed.ts:26,47`) and `lands.write`/`colonies.write` for land and
  colony management.

`readonly = true` removes every `*.write` from the set. `check_core` calls
`/health`, which is in `AUTH_SKIP` (`index.ts:53`) and needs nothing.

The token's own `permissions` array, when present, intersects with the
instance's set — it can only narrow. A token can never widen what its instance
grants.

## Core API

Two surfaces with different audiences, so they are mounted differently.

### Machine routes — instance id, no session

`packages/core/src/routes/mcp-machine.ts`, registered **between** `cors()`
(`index.ts:67`) and the JWT middleware (`index.ts:78`).

They must sit above the middleware: `AUTH_SKIP` (`index.ts:53`) would work, but
the skipped branch still runs `applyScope` → `resolveRequestScope`
(`index.ts:85`), which rejects a scope-less request on a `centralized` core
(`scope.ts:215-221`). The instance row already carries its own land/colony, so
these handlers resolve nothing from the request and must not be forced to.

| Route | Auth | Returns |
| ----- | ---- | ------- |
| `GET /api/_mcp/config` | `Authorization: Bearer <instanceId>` | `{ data: { instance: McpInstanceConfig } }` — label, land, colony, enabled, readonly, toolGroups, dynamicTools, dynamicMax |
| `POST /api/_mcp/session` | `Authorization: Bearer <instanceId>` + body `{ token }` | `{ data: { token, expiresAt, user, permissions } }` — a JWT scoped to the instance |

`403 MCP_DISABLED` when the instance is off. `401` for an unknown instance id, a
revoked/expired token, or a mismatched secret. The full token is never echoed
after creation, and `token_hash` never leaves the process.

The instance id alone can read `/config` and nothing else. It cannot mint a
session, so leaking it costs a tool-surface description, not data.

### Operator routes — console session

`packages/core/src/routes/mcp.ts`, mounted at `/api/_mcp` next to
`configRoutes` (`index.ts:603`). Normal JWT middleware, normal
`requireSession`/`requireWrite`.

| Route | Permission |
| ----- | ---------- |
| `GET /api/_mcp/instances` | `mcp.read` |
| `POST /api/_mcp/instances` | `mcp.write` |
| `GET /api/_mcp/instances/:id` | `mcp.read` |
| `PUT /api/_mcp/instances/:id` | `mcp.write` |
| `DELETE /api/_mcp/instances/:id` | `mcp.write` |
| `GET /api/_mcp/instances/:id/tokens` | `mcp.read` |
| `POST /api/_mcp/instances/:id/tokens` | `mcp.write` — returns the token **once** |
| `DELETE /api/_mcp/tokens/:tokenId` | `mcp.write` — revoke |

Scope resolution is the `_config` rules, not new ones: `resolveListTarget` /
`resolveColonyTarget` from `routes/config.ts:83-171`. Those two functions are
currently private to that file, so they move to a shared module and `config.ts`
imports them back — `check:config-scope-acl` keeps the original honest. A land
admin must name `?colony=` (`SCOPE_REQUIRED`), a colony admin cannot leave its
colony, an unregistered colony is `404`, and a token minted for one instance
never authenticates against another.

Deleting an instance deletes its tokens in the same pass, so there is no
orphaned credential.

### New permissions

`mcp.read` and `mcp.write` join `PERMISSIONS` (`packages/types/src/auth.ts:16`).
Because `PRIVILEGE_SEEDS` is expressed as filters over `PERMISSIONS` and
`ensurePrivileges` merges missing entries into existing system rows
(`privileges.ts:163-176`), existing deployments pick them up on next request
with no migration:

- `land_admin`, `admin` — both.
- `manager` — `mcp.read` only; it already excludes `config.write`
  (`auth.ts:87-97`) and MCP configuration is the same class of change.
- `viewer` — `mcp.read` (it takes every non-`lands.` `*.read`, `auth.ts:122`).
- `editor`, `panel_user` — neither.

## MCP worker changes

`MCP_INSTANCE_ID` joins `CORE_API_URL` in `src/env.ts`. Everything else becomes
optional overrides.

`src/core.ts` gains two calls and one cache, mirroring `collections.ts`:

- `loadInstanceConfig()` — `GET /_mcp/config`, cached 60 s per base URL, and
  **degrades to env** when `MCP_INSTANCE_ID` is unset.
- `sessionToken(userToken)` — `POST /_mcp/session`, cached until `expiresAt`
  (~15 min), keyed on the token. This replaces `token()`'s admin-key mint; the
  existing `__mcpTokenCache` entry changes shape to hold an expiry rather than
  a one-hour guess.

`defaultScope`, `readonly` and the tool-group set read from the instance config,
so `CoreClient` stops reading `CORE_LAND`/`CORE_COLONY`/`MCP_READONLY` on the
new path. `assertWritable()` stays — it is a clear error message for the model,
not the enforcement.

`src/index.ts` replaces the static `MCP_BEARER_TOKEN` comparison
(`index.ts:70-79`) with: forward the client's `Authorization: Bearer` to
`sessionToken()`, and on failure return the core's error verbatim. A 401 from
the core must reach the client as a 401, not as a generic MCP transport error.

The tool surface then shrinks to what the instance allows. A group the operator
did not grant is not registered, so the model never sees a tool that would 403.

### Backward compatibility

With `MCP_INSTANCE_ID` unset the worker behaves exactly as it does today:
`CORE_API_TOKEN`, else mint from `CORE_ADMIN_KEY`, `MCP_BEARER_TOKEN` as a static
guard. Kept for one minor release, removed in `0.3.0`.

The deprecation is loud, because silent fallback is what produced the current
mess: the root JSON (`index.ts:49-60`) reports `mode: "legacy"` with a warning,
and setting **both** `CORE_API_TOKEN` and `CORE_ADMIN_KEY` logs the precedence
explicitly instead of shadowing one with the other (`core.ts:61-62`).

`templates/mcps/basic/wrangler.jsonc` becomes a two-var file, and
`packages/cli/src/commands/add-mcp.ts` stops writing `CORE_ADMIN_KEY` into dev
vars (`add-mcp.ts:99-120`).

## Console changes

New `packages/console/src/pages/Mcp.tsx`, routed at `/mcp` in
`src/lib.tsx:71-90`, nav entry in `Layout.tsx:1172-1187` gated on `mcp.read`
alongside `/config` and `/users`. API helpers on the existing `api` object
(`src/lib/api.ts:517-527` has the `listConfigs`/`putConfig` precedent).

The page has two levels:

- **Instances** — label, id (copyable), land/colony, enabled, readonly, tool
  groups, token count. Create, edit, delete.
- **Instance detail** — a config form, a token table, and a ready-to-paste
  client snippet carrying the worker URL, the instance id and the token.

A newly created token is shown once in a `Sheet`, with the note that it cannot
be recovered. That is the only moment the plaintext exists outside the issuing
request.

## Gates

New `packages/core/scripts/check-mcp-instance-acl.mjs`, modelled on
`check-config-scope-acl.mjs` (`check-config-scope-acl.mjs:13-29` lists its seven
rules). It must pin:

1. a land admin gets `SCOPE_REQUIRED` without `?colony=`;
2. a colony admin cannot read another colony's instance;
3. a token scoped to colony A fails on a colony-B instance;
4. `token_hash` never appears in any response;
5. a revoked token is `401`; an expired one is `401`;
6. a disabled instance is `403 MCP_DISABLED` on both machine routes;
7. a token whose `permissions` omit `records.write` gets `403` from
   `POST /api/{collection}` — the read-only promise holds *server-side*;
8. a session JWT minted for an instance is rejected when the worker sends
   different `x-land`/`x-colony` (`scope.ts:269-282`).

Registered as `check:mcp-instance-acl` in the root and core `package.json`,
alongside the existing five live gates.

## Rollout

`@hamolus/types` → `@hamolus/core` → `@hamolus/mcp` → `@hamolus/console` →
CLI + templates + docs → gates → release as `0.2.10`.

The types package first because the permission mapping has to exist in one
place before the core can mint against it: `packages/types/src/mcp.ts` becomes
the canonical `MCP_TOOL_GROUPS` / `DEFAULT_MCP_TOOL_GROUPS` /
`MCP_GROUP_PERMISSIONS` / `mcpInstanceSchema` / `mcpTokenSchema`, and
`packages/mcp/src/env.ts` re-exports the group list instead of declaring a
second copy.

## Open decisions

1. **Instance id entropy and rotation.** 26 base62 chars (~155 bits) is the
   plan. Rotation means re-issuing the id, which invalidates the worker's
   `wrangler.jsonc` var but *not* any issued token — tokens are independent.
   Confirm that separation is what you want.
2. **Session TTL.** 15 minutes, cached in the worker. Longer means fewer
   round trips; a revoked token stays live for up to that long. 15 min is the
   proposal.
3. **Legacy path removal.** Kept for `0.2.x`, removed in `0.3.0`. The
   alternative is breaking every existing deployment on upgrade.

## See also

- [`deploying.md`](./deploying.md) — the current env-based setup this replaces
- [`definitions/config-definition.md`](./definitions/config-definition.md) — why
  this is *not* a `_configs` entry
- `packages/core/scripts/check-config-scope-acl.mjs` — the ACL gate to copy
