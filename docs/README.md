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
| [Deploying](./deploying.md) | one-click deploy buttons, resources, secrets, configurations, console/panel deploys |

### Definitions

The four things you can define, and where each one lives. Start here if you are
not sure which document you want.

| Document | Declares |
| -------- | -------- |
| [Collection definition](./definitions/collection-definition.md) | the fields of one table |
| [Field definition](./definitions/field-definition.md) | one column of a collection |
| [Panel definition](./definitions/panel-definition.md) | an app surface: views, metrics, access |
| [Config definition](./definitions/config-definition.md) | project settings: locales, uploads, theme |

[Definitions index](./definitions/README.md) — the four side by side, and why
three of them are database rows while one is a file.

### Contributing

| Document | Covers |
| -------- | ------ |
| [Contributing](../CONTRIBUTING.md) | the workflow, the gates, compatibility, and the private security channel |
| [Writing guide](./writing-guide.md) | prose and code conventions for this repo |

## Repository layout

```
packages/cli         the scaffolder (hamolus init / create / add / link / list)
packages/create-hamolus  the initializer npm runs for `npm create hamolus@latest`
packages/core        the API Worker — Hono + Drizzle on D1, KV, R2
packages/console     SolidJS + StyleX admin app (also the `add console` source)
packages/types       shared Zod schemas, types and DTOs
packages/panel       framework-neutral browser client for the Panel API
packages/mcp         MCP server exposing the core API as tools
packages/plugins     console plugin workspace (contracts + todo + kanban)
templates/           canonical CLI templates (cores, panels, sites, seeds, configurations)
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
pnpm check:markers             # template token + theme-script drift gate (offline, fast)
pnpm check:workspace-glob      # workspace/glob regression gate
pnpm check:copyright           # copyright/author notice on every published file
pnpm check:generated-app       # generate → install → typecheck → build a real project
pnpm check:code-definitions    # offline gate for code-defined collections/panels
pnpm check:code-defined-core   # the same contract over HTTP (needs a generated core)
pnpm check:panel-acl           # live panel ACL gate (needs a running core)
pnpm check:mcp-instance-acl    # live MCP instance/token ACL gate (needs a running core)
pnpm check:scope-colony-resolution
```

`check:markers` and `check:generated-app` answer different questions and both
matter: the marker gate proves the template *copy* is faithful (no unsupplied
`{{TOKEN}}`, every token present, the console's pre-paint theme script byte-matches
the one shipped in the console), while `check:generated-app` proves the copied files
form an app that installs, typechecks and builds — which is where a generated
console can fail, because it consumes `@hamolus/console` as a pre-built library
rather than vendoring the UI. The slow gate needs a warm pnpm store and
`pnpm -F @hamolus/console build:lib`.

`check:code-definitions` and `check:code-defined-core` split one contract in two.
The first needs no Worker: it loads the definition registry in-process and
asserts boot-time validation, duplicate detection, the guard helpers, and that a
failed write leaves the previous definitions standing. The second needs a core
built from the `predefined` template (`hamolus create acme --core predefined`),
and asserts what only a running Worker can show — the `posts` collection and
`content` panel are served straight after start with their declared fields,
`PUT`/`DELETE` on them are refused with `403`, records inside them stay editable,
and a land registered later comes up with the same baseline.

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

A part is generated from a named directory under its kind (`cores/basic`,
`panels/basic`, …), and `--template <path>` overrides the name with a directory of
your own. Cores have two templates: `basic` ships no collections or panels, while
`predefined` ships a `posts` collection and a `content` panel under `core/src/`,
declared in source control and therefore frozen against API edits. Pick it with
`hamolus create <name> --core predefined`.

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
| site (astro, explicit in `astro.config.mjs`) | 4321 |
| site (next, `next dev` default) | 3000 |

Every generated `dev` script binds the host the project was created with, so all of
them answer on the LAN together or none of them do:

```bash
hamolus init acme --host 0.0.0.0          # or: hamolus init, then answer yes to the LAN question
```

A site generated for a LAN project still reads `http://localhost:8787`, because
`0.0.0.0` is a bind address and not a destination.
