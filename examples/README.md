# examples

Scaffolded example applications built on the Hamolus **frontend** and **mobile app** side.

This folder is not a package the repo builds. `examples/` is deliberately **not** in
`pnpm-workspace.yaml` and has no task in `turbo.json`, so:

- `pnpm install` / `pnpm build` at the root do not touch anything in this folder;
- each example has its own `package.json` and is installed separately when you want to use it;
- breakage in one example does not fail the repo's CI.

What lives here is a *starting point*: one minimal example that already runs after
`pnpm install` + `pnpm dev`, and small enough to read as a reference.

## Folder map

```
examples
├── panels/            SolidJS apps built on @hamolus/panel (token required)
│   ├── seo-dashboard      SEO metrics + record list
│   ├── inventory          warehouse stock: read, filter, adjust stock
│   └── booking-kalendar   booking calendar per date & locale
├── consoles/          @hamolus/console admin console
│   └── with-plugins       console that mounts the todo + kanban plugins
├── sites/             public sites that read data through the core REST API
│   ├── astro/
│   │   ├── blog           articles, SSG, Markdown
│   │   ├── corporate      profile & team pages, multi-locale
│   │   └── ecommerce      catalog + filters + pagination
│   └── nextjs/
│       └── blog           articles, ISR/streaming
└── apps/              mobile apps
    └── flutter/
        └── accounting     native accounting app (Dart)
```

## The three kinds of consumption

| Group | What it uses | Auth | When to use it |
| --- | --- | --- | --- |
| `panels/` | `@hamolus/panel` | panel token required | internal tools with a per-role ACL, manifest-driven |
| `consoles/` | `@hamolus/console` | admin login | a generic admin: collections, media, users, settings |
| `sites/`, `apps/` | `fetch` against the core REST API | usually no token | content that is read publicly and written through a console/panel |

Two things people most often get wrong:

1. **Sites and mobile apps do not use `@hamolus/panel`.** That package is bound to the panel
   endpoints (`/api/_panels/...`) and needs a token. Public content is read straight from
   `GET /api/{collection}`, which — as long as `PUBLIC_GETS` on the core is still `true`
   (the default) — can be called without an `Authorization` header. Do not send that header
   when you have no token: the middleware demands a valid JWT as soon as `Authorization`
   shows up, so `PUBLIC_GETS=true` no longer saves that request.
2. **The console is not hand-written.** `@hamolus/console` already ships the UI, router, and
   stylesheet; a project only writes `console.config.ts` and one `mount()` line. The example
   in `consoles/with-plugins/` adds plugins on top of that rather than replacing it.

## Running an example

Every example needs a running core first:

```bash
# from the repo root
pnpm hamolus create acme --core predefined
cd acme
pnpm install
pnpm hamolus add console
pnpm dev            # core worker at http://localhost:8787
```

Then, from the example folder you want to run:

```bash
cd examples/panels/seo-dashboard
pnpm install
pnpm dev            # http://localhost:5173 (host 0.0.0.0, also reachable via mac.lan)
```

## `@hamolus/*` dependencies

The examples use the `^0.2.0` registry range, same as a project created by
`hamolus create`. The three console plugins (`@hamolus/plugin-console-*`) are still
at `^0.1.0`; they did not change in `0.2.0` and are versioned separately. While the
packages are still developing, point every `@hamolus/*` at a
local checkout:

```bash
pnpm hamolus link ../..        # from the repo root, or an absolute path to the checkout
```

`link` writes an absolute `link:` specifier into each manifest, so **do not commit** a
manifest that has been linked. To undo it: `pnpm hamolus link --clear`.

## Creating a new example with the CLI

The examples in this folder are deliberately built with CLI commands, so they never drift
from what the generator actually outputs:

```bash
# panel
pnpm hamolus add panel inventory --output examples/panels/inventory
# then trimmed: drop whatever is irrelevant to the example

# console
pnpm hamolus add console --output examples/consoles/with-plugins
pnpm hamolus add plugin todo --output examples/consoles/with-plugins
pnpm hamolus add plugin kanban --output examples/consoles/with-plugins
```

## Content rules

- Every example folder needs a `README.md` naming: the domain, the core it requires, the env
  that has to be filled in, and the command to run it.
- Env files are never committed. Only `.env.example` is present.
- Example code uses public APIs only: `GET /api/{collection}` for public content,
  `@hamolus/panel` for panels, `@hamolus/console` for the console.
- The `examples/private/` folder is ignored by the root — never commit real credentials.
