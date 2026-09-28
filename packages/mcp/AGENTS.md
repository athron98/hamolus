# `@hamolus/mcp` — the MCP server

A Cloudflare Agents worker that exposes a core's API to an AI client as MCP tools.
It is a **thin, deterministic surface over the existing REST API**: every tool is one
HTTP call to the core, with the same auth, the same scope headers, and the same
validation. There is no second data path and no local cache to go stale.

## Ships raw TypeScript

`main` and `types` point at `./src/index.ts` and `files` ships `src/`. Same reasoning
as `@hamolus/core`: a project can wrap or extend the Agent entry without a build
step. A syntax error in `src/` breaks every generated MCP server at once.

`build` is `wrangler deploy --dry-run --outdir=dist` — a compile check, not a bundle.

## Commands

```bash
pnpm -F @hamolus/mcp typecheck
pnpm -F @hamolus/mcp dev              # wrangler dev
pnpm -F @hamolus/mcp deploy
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/index.ts` | the Agent: name, instructions, `registerTools()` call, a no-op health tool, an `onRequest` CORS shim |
| `src/tools.ts` | every tool: its Zod input schema, its description, its call into `CoreClient` |
| `src/core.ts` | `CoreClient` — a typed wrapper over the core REST API, with an `ask` escape hatch |
| `src/env.ts` | bindings, including the core's password and the configured scopes |
| `docs/` | shipped documentation for the host project |

## The tool surface

Tools are **snake_case and verb-first**: `list_lands`, `list_colonies`, `get_stats`,
`get_settings`, `update_settings`, `list_groups`, `put_group`, `delete_group`,
`list_collections`, `get_collection`, `put_collection`, `delete_collection`,
`list_records`, `get_record`, `create_record`, `update_record`, `delete_record`,
`bulk_delete_records`, `list_media`, `list_documents`, `list_attachments`.

## Invariants

- **One new concept means one new tool, not one new concept plus a new transport.**
  The API already exists; the tool calls it. If a tool needs a bespoke endpoint, the
  endpoint belongs in `@hamolus/core` first.
- **A tool description is the model's only documentation.** Say what the tool returns
  *and* what it refuses or will not do, because the model decides from that text
  alone. Keep them specific: a description that repeats the name helps nobody.
- **The tool is a thin wrapper; `CoreClient` owns the transport.** Auth, scope headers,
  error normalisation and the base URL live in `src/core.ts` and nowhere else.
- **Errors are returned, not thrown at the transport.** A tool that throws kills the
  turn; a tool that returns the core's error payload lets the model adapt. Preserve
  `INVALID_QUERY`, `FORBIDDEN` and `NOT_FOUND` wording.
- The scope the MCP server may touch is set by the project's env, not by the caller. A
  request for a land outside that set is refused server-side.
- Keep `sideEffects: false` true in `package.json`; a project imports this entry to
  compose an Agent.

## Gates

There is no gate script in this package. `pnpm typecheck && pnpm build` from the
repository root is the check, and the runtime surface is pinned by
`pnpm check:panel-acl` and `pnpm check:localization-api` on the core side — a tool
whose name or payload drifts from the route it calls shows up there, not here.

## Conventions

- Copyright/author/SPDX header verbatim (`pnpm check:copyright`).
- Every tool gets a doc comment stating the call it makes, and — when it accepts
  filters — which of the strict list-query keys it honours.
- Comments are English; commit messages follow Conventional Commits with the package as
  the scope.
