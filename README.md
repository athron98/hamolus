# Hamolus

A headless data platform on Cloudflare Workers. You describe a **collection** as
metadata; Hamolus creates the D1 table, serves a multi-tenant CRUD API for it, and
generates the admin console, panels and AI tooling around it.

There is no application to fork. A Hamolus project is assembled from parts:

```
core/       the API Worker (thin seam over @hamolus/core)
console/    SolidJS admin app
panels/     generated data-driven app surfaces
mcp/        Model Context Protocol server for AI agents
site/       the public site (Astro, Next.js) reading the core over REST
seeds/      data generators
configs/    wrangler presets (staging, production, per land)
```

## Quickstart

```bash
npm create hamolus@latest     # asks twelve questions, then builds the project
```

or, if you would rather answer with flags — or already have the CLI:

```bash
pnpm add -g @hamolus/cli     # or: npx @hamolus/cli
hamolus init                  # the same twelve questions
hamolus create acme           # or skip them entirely
cd acme
pnpm install
pnpm dev                      # every part, in parallel
```

`hamolus init` and `npm create hamolus@latest` are the same command; every question has a
flag, and a question whose flag you pass is not asked. So a project is one line:

```bash
hamolus init acme --mode centralized --land acme --with-console --with-mcp --with-site nextjs
```

and `hamolus create acme` plus a few `hamolus add` calls is the same project, written out.

```bash
hamolus add console          # admin app
hamolus add panel basic      # a generated panel app
hamolus add mcp              # MCP server for AI agents
hamolus add site blog        # a public Astro site reading the core over REST
hamolus add seed basic       # example content, so a new site has something to show
hamolus add configuration basic
```

Each flag adds that part and nothing else, so a project is one line:

```bash
npm create hamolus@latest acme --with-console --with-mcp --with-site nextjs
```

### Example content

A new project has an empty database, so a new site renders an empty page — which reads as a
broken site rather than an empty one. A seed is a self-cleaning Node script that fills the
core with a few records, and the wizard offers it as question 12:

```bash
hamolus create acme --with-site astro        # question 12 defaults to yes: a site wants content
hamolus create acme --with-console          # and to no: a console is only empty
hamolus create acme --with-site astro --seed basic   # or say so
hamolus create acme --with-site astro --no-seed      # or decline it
```

Run it once the core is up, which is why it is not part of `pnpm dev` — a seed is a one-shot
script, and starting it before the core listens is a connection error:

```bash
pnpm dev
ADMIN_KEY=$(grep '^ADMIN_KEY=' core/.dev.vars | cut -d= -f2-) pnpm -F ./seeds/basic seed
```

Re-running it is safe: the script drops the collections and media it owns before recreating
them, so it never duplicates records.

A seed has no `--with-` spelling, unlike the parts above. It writes to a core over HTTP, so
"a seed with no core" is a script that can never run — `hamolus create acme --console --seed
basic` is refused rather than scaffolded into a directory that fails on its first fetch.

### `--console` or `--with-console`

Every part flag has two spellings, and the difference is whether you get a core.

```bash
hamolus create acme --with-console          # a core and a console
hamolus create acme --console               # a console, and no core
```

`--with-` is the whole project: a core, its mode, its land and colony, `core/.dev.vars` with
a generated `JWT_SECRET` and `ADMIN_KEY`, and a `deploy` script. The bare flag is
`hamolus add console` applied to a new project, so you get **only** the console. It has no
`core/`, no secrets and no `mode`, and it talks to a core that already runs somewhere else —
at runtime, not compiled in, so the same build works against a preview or a production core
without being rebuilt. The console asks for the endpoint in its navbar; an MCP server reads
`CORE_API_URL` from `mcp/.env`; a site reads `PUBLIC_HAMOLUS_ORIGIN` from `site/.env`.

The bare spelling composes, so a workspace of parts is still one line:

```bash
hamolus create acme-console --console --mcp      # no core
hamolus create acme --with-console --with-mcp   # a core, and both
```

Mixing the two spellings is refused, because `--console` says there is no core and
`--with-mcp` says there is one. A panel is a page *inside* the console, so
`--panel admin` on its own builds fine and displays nothing — `hamolus add panel` warns, and
`--with-panel admin` is usually what you want.

`hamolus list` shows what a project contains and where each part came from.

The wizard writes a working `JWT_SECRET` and `ADMIN_KEY` into `core/.dev.vars`, so
`pnpm dev` runs without a second step. That file is git-ignored; anything you deploy wants
`wrangler secret put` instead.

### Reaching a dev server from your phone

The seventh question is the LAN. `y` binds the core, the console, the MCP server and any
site to `0.0.0.0`; a host name like `mac.lan` binds them there instead; `n` keeps everything
on `127.0.0.1`. The answer is written into each part's `dev` script rather than left as a
flag to remember, so a project is either reachable as a whole or not at all. It is also
`hamolus create acme --host 0.0.0.0` afterwards, and `hamolus link`-free either way.

### Dev ports

The core listens on 8787 and the MCP server on 8788, so a root `pnpm dev` can start both
at once. Both read their port from the environment when you need a different one:

```bash
HAMOLUS_CORE_PORT=8797 HAMOLUS_MCP_PORT=8798 pnpm dev
```

A second checkout of the same project on one machine is a variable rather than a source
edit. This is a `wrangler dev` setting only — a deployed Worker is addressed by its URL
and has no port, so nothing here affects a deploy.

### Core templates

The core is generated from a named template under `templates/cores/`:

| Template | Ships | Use when |
| -------- | ----- | -------- |
| `basic` (default) | nothing — no collections, no panels | the schema belongs to whoever is building it, in the console or the API |
| `predefined` | a `posts` collection and a `content` panel in `core/src/` | you want the schema reviewed in a pull request |

```bash
hamolus create acme --core predefined
```

A collection or panel declared in `core/src` is **frozen** against the API — `PUT`/`DELETE`
answers `403 CODE_DEFINED_COLLECTION` / `403 CODE_DEFINED_PANEL` — while its records stay
fully editable. Anything not declared there stays editable everywhere.

### Working against a local checkout

```bash
hamolus create acme --link ../hamolus   # or: hamolus link ../hamolus
```

Linking rewrites the `@hamolus/*` dependencies to absolute `link:` paths so changes
in the checkout are picked up immediately. `hamolus link --clear` puts the registry
ranges back.

## Modes

The core's `CORE_MODE` decides how land resolution and rewriting behave:

| Mode | `PUBLIC_GETS` | Use for |
| ---- | ------------- | ------- |
| `independent` | `true` | one core per customer/site (default) |
| `centralized` | `false` | one core, many lands resolved from the request |
| `proxy` | `false` | land carried in the path, forwarded upstream |
| `bridge` | `false` | routes resolved through an `upstreams:v1` map |

Pick one at creation time with `--mode`, or add a configuration per mode later.

## Packages

| Package | What it is |
| ------- | ---------- |
| [`@hamolus/cli`](packages/cli) | the scaffolder — `hamolus init` / `create` / `add` / `link` / `list` |
| [`create-hamolus`](packages/create-hamolus) | the initializer behind `npm create hamolus@latest` |
| [`@hamolus/core`](packages/core) | the API Worker: dynamic CRUD, scope, media, panels |
| [`@hamolus/console`](packages/console) | the SolidJS admin app (also the `add console` source) |
| [`@hamolus/types`](packages/types) | shared Zod schemas, types and DTOs |
| [`@hamolus/panel`](packages/panel) | framework-neutral browser client for the Panel API |
| [`@hamolus/mcp`](packages/mcp) | MCP server exposing the core API as tools |
| [`@hamolus/plugin-console-contracts`](packages/plugins/console/contracts) | plugin contracts + design tokens |

`packages/plugins/console/{todo,kanban}` are example console plugins used by
`hamolus add plugin`.

## Working in this repository

```bash
pnpm install
pnpm typecheck                # all packages
pnpm build                    # all packages
pnpm check:markers            # template token + theme-script drift gate (offline)
pnpm check:workspace-glob     # workspace + glob regression gate
pnpm check:copyright          # copyright/author notice on every published file
pnpm check:generated-app      # generates a project, installs it, typechecks + builds it
pnpm check:code-definitions   # offline gate for code-defined collections/panels
pnpm check:code-defined-core  # the same contract over HTTP (needs a generated core)
pnpm check:panel-acl          # live panel ACL gate (needs a running core)
pnpm check:scope-colony-resolution
```

`pnpm hamolus -- <args>` runs the CLI from source.

Canonical CLI templates live in [`templates/`](templates) and are copied into
`packages/cli/templates` by `prepack`, so a published CLI ships them.

`check:generated-app` is the slow gate: it needs a warm pnpm store (it installs the
generated project's devDependencies) and a built console library
(`pnpm -F @hamolus/console build:lib`). `check:markers` is its fast counterpart —
it proves the template *copy* is faithful without installing anything.

## Documentation

- [Docs index](docs/README.md)
- [Definitions](docs/definitions/README.md) — collections, fields, panels, config
- [Collection definition](docs/definitions/collection-definition.md) — the schema of one table
- [Field definition](docs/definitions/field-definition.md) — one column, and all 19 types
- [Panel definition](docs/definitions/panel-definition.md) — views, metrics and access
- [Config definition](docs/definitions/config-definition.md) — locales, uploads, theme
- [Architecture](packages/core/docs/architecture.md)
- [Core API reference](packages/core/docs/api.md)
- [KV settings](packages/core/docs/settings.md)
- [Console guide](packages/console/docs/console.md)
- [Panels](packages/panel/docs/panels.md)
- [MCP server](packages/mcp/docs/mcp.md)
- [Deploying](docs/deploying.md)
- [Contributing](CONTRIBUTING.md) — workflow, gates, compatibility, and how to
  report a security issue privately
- [Writing guide](docs/writing-guide.md) — conventions for prose and code here

## License

MIT — see [LICENSE](LICENSE).
