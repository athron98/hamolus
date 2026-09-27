# {{PROJECT_LABEL}} core

The API Worker for {{PROJECT_LABEL}}, running in **{{CORE_MODE}}** mode.

There is almost nothing in this folder on purpose. Every route, query and migration lives in
the `@hamolus/core` package; this Worker is a thin seam around it.

## Layout

```
core/
├─ src/index.ts        the seam: imports the app and applies the build-time config
├─ core.config.ts      build-time settings (locales), overridable from KV
├─ wrangler.jsonc      bindings, resource names, CORE_MODE
└─ tsconfig.json       self-contained — no extends ../../tsconfig.base.json
```

## Where the schema comes from

This template ships **no collections and no panels**: the project starts empty and you
create what it needs, from the console or straight from the API. That is the deliberate
default — the schema belongs to whoever is building the product, and nothing is frozen
before it exists.

```bash
# through the API, once the core is running
curl -X PUT localhost:8787/api/_meta/collections/posts -H 'content-type: application/json' -d '…'
```

The D1 table is created and migrated from that definition, so there is no migration step to
run here. The core bootstraps its own metadata tables on the first request.

## Defining the schema in code instead

If you want the schema reviewed in a pull request rather than typed into the console, the
`predefined` template ships that seam and one example of it:

```bash
hamolus create {{PROJECT_NAME}} --core predefined
```

That variant adds two directories and one call in `src/index.ts`:

```
core/src/collections/    collections this project defines in code
core/src/panels/         panels this project defines in code
```

```ts
import app, { setCodeDefinitions, setCoreConfig } from '@hamolus/core'
import { config } from '../core.config'
import { collections } from './collections'
import { panels } from './panels'

setCoreConfig(config)
setCodeDefinitions({ collections, panels })

export default app
```

What is declared there is **read-only at runtime**: `PUT`/`DELETE` on a declared collection
and `PUT`/`PATCH`/`DELETE` on a declared panel are refused with `403
CODE_DEFINED_COLLECTION` / `403 CODE_DEFINED_PANEL`. Records, including panel-owned assets,
stay fully editable. Change a definition by editing the file, not the API.

Collections the console creates stay editable: declaring `posts` in code never freezes the
scratch collection you add beside it. To stop freezing something, delete it from the list —
a definition that is omitted from `setCodeDefinitions` is not special. A definition that
fails schema validation stops the Worker at boot rather than serving a broken schema, and
the error names every problem at once.

## Wrapping the app instead of forking it

`src/index.ts` is yours. Add middleware, mount your own routes, or install a custom error
handler around the imported app:

```ts
import app from '@hamolus/core'

app.use('/api/_meta/hello', (c) => c.json({ ok: true }))
app.onError((err, c) => c.json({ error: { code: 'INTERNAL', message: err.message } }, 500))

export default app
```

## Cloudflare resources

The ids in `wrangler.jsonc` are placeholders. Create the real ones, then paste the ids
Wrangler prints:

```bash
wrangler d1 create {{DB_NAME}}          # → d1_databases[].database_id
wrangler kv namespace create {{KV_NAMESPACE}}   # → kv_namespaces[].id
wrangler r2 bucket create {{BUCKET_NAME}}      # → r2_buckets[].bucket_name
```

Then set the secrets (a secret and a var can never share a name):

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_KEY
```

For local development put them in `.dev.vars` **next to this file** instead — that file is
git-ignored. Wrangler resolves `.dev.vars` relative to `wrangler.jsonc`, and `wrangler dev`
always runs with this directory as its working directory, so a `.dev.vars` in the project
root is silently ignored (the Worker then starts with no `ADMIN_KEY` and
`POST /api/_auth/token` answers `INVALID_KEY`).

## Modes

`CORE_MODE` in `wrangler.jsonc` selects the tenancy model. Nothing else changes between
modes: the package reads the var at runtime.

| Mode | Shape |
| --- | --- |
| `independent` | one tenant, no land/colony routing |
| `centralized` | many lands behind one Worker; every request must resolve a land |
| `proxy` | one land, path-prefix routing forwarded to upstreams |
| `bridge` | joins lands across cores via `upstreams:v1` |

## Commands

```bash
pnpm -F ./core dev        # http://localhost:8787
pnpm -F ./core typecheck
pnpm -F ./core build      # wrangler dry-run bundle
pnpm -F ./core deploy
```

## Seeds

`hamolus add seed <name>` adds a seed script under `seeds/` if you want demo data.

A seeded collection is still a collection — seeding it again adds records, it does not
declare the schema.
