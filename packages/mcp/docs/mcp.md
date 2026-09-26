# MCP server (`packages/mcp`)

A stateless Cloudflare Worker that exposes the core API to MCP-capable clients
(e.g. opencode). It starts a `McpServer` and registers generic tools for the
core's metadata, records, and file libraries.

Transport is **Streamable HTTP** on `POST /mcp` (stateless — every request
stands alone; no session, no progress/notification support).

## Why this shape

- **Stateless**: the Worker builds a fresh server + client per request via
  `createMcpHandler(() => createServer(env), { route: '/mcp' })`. Fine for
  tool-call only workloads (we never send notifications).
- **Generic tools instead of per-collection tools**: collections are dynamic
  (schema lives in the core), so tools take a `collection`/`data` argument and
  you prefix with `get_collection` to learn the field schema. No resource
  definitions on purpose — v1 keeps the tool surface, not the URL tree.

## Tools (21)

| Tool | Kind | Notes |
| --- | --- | --- |
| `list_lands` / `list_colonies` | global | land/colony registry (no scope headers needed) |
| `get_stats` | read | dashboard stats |
| `get_settings` / `update_settings` | read / write | KV settings blob; PUT is a shallow merge |
| `list_groups` / `put_group` / `delete_group` | read / write | `parent` must exist; cycles rejected |
| `list_collections` / `get_collection` | read | full definitions incl. fields |
| `put_collection` / `delete_collection` | write | PUT creates/migrates the D1 table; DELETE drops it |
| `list_records` / `get_record` | read | `?search=`, `?locale=`, `sortBy`/`sortDir`, paging |
| `create_record` / `update_record` / `delete_record` | write | `data` validated by the core |
| `bulk_delete_records` | write | `ids` array |
| `list_media` / `list_documents` / `list_attachments` | read | taxonomy filters + search |

Every tool also accepts optional `land`/`colony` arguments that override the
server default `x-land`/`x-colony` (multi-scope cores only).

## Env

All vars are secrets/bindings, never committed:

| Var | Meaning |
| --- | --- |
| `CORE_API_URL` | core base URL **including `/api`** (default `http://localhost:8787/api`) |
| `CORE_API_TOKEN` | pre-minted core JWT (alternative to `CORE_ADMIN_KEY`) |
| `CORE_ADMIN_KEY` | admin key; the server mints a token from `POST /api/_auth/token` once (cached ~1 h) |
| `CORE_LAND` / `CORE_COLONY` | default land / colony for `x-land` / `x-colony` |
| `MCP_BEARER_TOKEN` | optional guard on `POST /mcp` (`Authorization: Bearer <token>`); unset = open |
| `MCP_READONLY` | `"true"` → every **write** tool refuses (safe exploration / review mode) |

If neither `CORE_API_TOKEN` nor `CORE_ADMIN_KEY` is set, every tool errors with a
clear message. The server never proxies `/media`, `/documents`, or
`/attachments` public-file routes — only `/api`.

## Run

```bash
# local
cd packages/mcp
# write .dev.vars (gitignored) — model it on the example in .env.example §mcp
pnpm exec wrangler dev --port 8790 --ip 0.0.0.0
```

`.dev.vars` (gitignored) example:

```
CORE_API_URL=http://localhost:8787/api
CORE_ADMIN_KEY=dev-admin-key-change-me
# MCP_BEARER_TOKEN=change-me
# MCP_READONLY=true
```

Verify with curl (JSON-RPC over Streamable HTTP, SSE accept is required):

```bash
curl -X POST http://localhost:8790/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"x","version":"0"}}}'
```

## Deploy

```bash
# root
pnpm deploy:mcp
# or from the package
cd packages/mcp && pnpm deploy
```

Then set the secrets (wrangler.com or `wrangler secret put`):

```
CORE_API_TOKEN   # or CORE_ADMIN_KEY
MCP_BEARER_TOKEN # if you want the /mcp guard
MCP_READONLY     # optional "true"
CORE_LAND/CORE_COLONY  # optional tenant defaults
```

Public env var `CORE_API_URL` (with `/api`) can stay in `wrangler.jsonc` `vars`.
Use the deployed worker URL — e.g. `https://hamolus-mcp.<subdomain>.workers.dev/mcp`
— in opencode's `mcp` config.

## OpenCode registration

Config lives in `~/.config/opencode/opencode.jsonc`:

```jsonc
"mcp": {
  "Hamolus": {
    "type": "remote",
    "url": "https://hamolus-mcp.YOUR_SUBDOMAIN.workers.dev/mcp",
    "headers": { "Authorization": "Bearer {env:MCP_BEARER_TOKEN}" },
    "enabled": false
  },
  "Hamolus-local": {
    "type": "remote",
    "url": "http://localhost:8790/mcp",
    "enabled": false
  }
}
```

Both are registered **disabled**; flip `enabled: true`, set the env var, and
restart opencode (config is loaded once at startup). Read-only exploration:
deploy with `MCP_READONLY=true`.