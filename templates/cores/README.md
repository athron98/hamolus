# {{PROJECT_LABEL}} core

The API Worker for {{PROJECT_LABEL}}, running in **{{CORE_MODE}}** mode.

There is almost nothing in this folder on purpose. Every route, query and migration lives in
the `@hamolus/core` package; this Worker is a thin seam around it.

## Layout

```
core/
├─ src/index.ts   the seam: `export { default } from '@hamolus/core'`
├─ wrangler.jsonc bindings, resource names, CORE_MODE
└─ tsconfig.json  self-contained — no extends ../../tsconfig.base.json
```

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

## Schema and seeds

Collections are metadata: `PUT /api/_meta/collections/{name}` creates and migrates the D1
table on the fly, so there is no migration step to run here. The core bootstraps its own
metadata tables on first request.

`hamolus add seed <name>` adds a seed script under `seeds/` if you want demo data.
