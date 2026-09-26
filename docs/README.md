# Hamolus — documentation

Hamolus is a headless data platform on Cloudflare Workers. Collections are **not
hard-coded**: you `PUT` a collection definition and the core creates the D1 table,
serves CRUD for it, and enforces the field rules. Everything else — console, panels,
AI tooling, seeds, deployment presets — is generated around that API.

## Documentation map

Each package owns its own reference; this page is the index and the contributor
workflow.

| Document | Covers |
| -------- | ------ |
| [Architecture](../packages/core/docs/architecture.md) | how the parts fit together, request flow, scope resolution |
| [Core API reference](../packages/core/docs/api.md) | auth, collections, records, relations, media, files, panels, lands, errors |
| [KV settings](../packages/core/docs/settings.md) | the settings blob schema and where it is read |
| [Console guide](../packages/console/docs/console.md) | the admin app: collections, records, media, panels, theming |
| [Panels](../packages/panel/docs/panels.md) | manifests, roles, generated apps, private assets |
| [MCP server](../packages/mcp/docs/mcp.md) | env, tools, running, wiring into an agent |
| [Deploying](./deploying.md) | resources, secrets, configurations, console/panel deploys |

## Repository layout

```
packages/cli         the scaffolder (hamolus create / add / link / list)
packages/core        the API Worker — Hono + Drizzle on D1, KV, R2
packages/console     SolidJS + StyleX admin app (also the `add console` source)
packages/types       shared Zod schemas, types and DTOs
packages/panel       framework-neutral browser client for the Panel API
packages/mcp         MCP server exposing the core API as tools
packages/plugins     console plugin workspace (contracts + todo + kanban)
templates/           canonical CLI templates (cores, panels, seeds, configurations)
docs/                this documentation set
```

## The idea

- a collection's **definition** (label, fields, flags, grouping) is stored as
  metadata, and its physical D1 table is created or migrated on first `PUT`;
- records are then served by a generic endpoint — `GET/POST/PUT/DELETE
  /api/{collection}[/{id}]` — with the field definitions driving validation,
  coercion, search, filters, relations and localization;
- **lands** (and optional **colonies**) isolate data per tenant: collections,
  records, privileges, settings, media and panels are all scoped;
- **panels** are data-defined app surfaces: a manifest says which collections,
  operations and fields a role may touch, and the core enforces it.

## Contributor workflow

```bash
pnpm install
pnpm typecheck                 # every package
pnpm build                     # every package
pnpm check:workspace-glob      # workspace/glob regression gate
pnpm check:panel-acl           # live panel ACL gate (needs a running core)
pnpm check:scope-colony-resolution
```

Run the CLI from source with `pnpm hamolus -- <args>`, e.g.

```bash
pnpm hamolus -- create acme
pnpm hamolus -- add console
```

To try a generated project against this checkout, create it with `--link`:

```bash
pnpm hamolus -- create acme --link . --output /tmp/acme
```

### Templates

`templates/` is the single source of truth for generated files. `packages/cli`
copies it into `packages/cli/templates` on `prepack`, so a published CLI ships the
same content that the repository develops against. Edit `templates/`, never the copy.

## Local development

```bash
pnpm -F @hamolus/core dev        # core API on http://localhost:8787
pnpm -F @hamolus/core db:setup   # optional eager DDL (the core self-bootstraps)
pnpm -F @hamolus/console dev     # console on http://localhost:5173
```

The console proxies `/api` to the core, so set `CORE_API_URL` if the core is not on
the default port:

```bash
CORE_API_URL=http://localhost:8787 pnpm -F @hamolus/console dev
```

### Credentials

Credentials are **secrets**, never vars — a secret and a var cannot share a name:

```bash
pnpm -F @hamolus/core exec wrangler secret put JWT_SECRET
pnpm -F @hamolus/core exec wrangler secret put ADMIN_KEY
```

`packages/core/wrangler.jsonc` ships placeholder resource ids so nothing private is
committed; create the real D1 database, KV namespace and R2 bucket, then paste the
ids — or let `hamolus add configuration` do it for you.

## Ports

| Service | Port |
| ------- | ---- |
| core (`wrangler dev` default) | 8787 |
| console (explicit in `vite.config.ts`) | 5173 |
| mcp (`wrangler dev` default) | 8787 — run it on another port, e.g. `--port 8790` |
