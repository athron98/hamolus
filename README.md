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
seeds/      data generators
configs/    wrangler presets (staging, production, per land)
```

## Quickstart

```bash
pnpm add -g @hamolus/cli     # or: npx @hamolus/cli
hamolus create acme
cd acme
pnpm install

hamolus add console          # admin app
hamolus add panel basic      # a generated panel app
hamolus add mcp              # MCP server for AI agents
hamolus add seed basic       # demo data
hamolus add configuration basic

pnpm dev                     # run the core locally
```

`hamolus list` shows what a project contains and where each part came from.

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
| [`@hamolus/cli`](packages/cli) | the scaffolder — `hamolus create` / `add` / `link` / `list` |
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
pnpm check:workspace-glob     # workspace + glob regression gate
pnpm check:panel-acl          # live panel ACL gate (needs a running core)
pnpm check:scope-colony-resolution
```

`pnpm hamolus -- <args>` runs the CLI from source.

Canonical CLI templates live in [`templates/`](templates) and are copied into
`packages/cli/templates` by `prepack`, so a published CLI ships them.

## Documentation

- [Docs index](docs/README.md)
- [Architecture](packages/core/docs/architecture.md)
- [Core API reference](packages/core/docs/api.md)
- [KV settings](packages/core/docs/settings.md)
- [Console guide](packages/console/docs/console.md)
- [Panels](packages/panel/docs/panels.md)
- [MCP server](packages/mcp/docs/mcp.md)
- [Deploying](docs/deploying.md)

## License

MIT — see [LICENSE](LICENSE).
