# Deploying

Hamolus is deployed as Cloudflare Workers plus static assets. Deploy the **core
first** — the console, panel apps and MCP server all talk to it.

There are two routes to a deployment. For the core, console and MCP there is a
**one-click path** that requires nothing but a GitHub account; the rest of this
page is the underlying, fully manual route that one-click automates.

## 0. Deploy in one click

Each deployable package is published, generated, to a public repository under
`hamolus-labs/{core,console,mcp}`. The `[![Deploy to
Cloudflare](https://deploy.workers.cloudflare.com/button)]` button in each of their
READMEs forks the repository into your GitHub account, names the Worker, and
Cloudflare provisions the KV namespace, D1 database and R2 bucket and wires
Workers Builds — later pushes to your fork deploy themselves.

The repositories are never edited by hand: `scripts/export-deploy-repo.mjs`
generates them from `packages/*`, so a fork is always the current source. The
export strips the placeholder resource ids (so Wrangler auto-provisions), rewrites
`workspace:*` to real ranges (so `pnpm install` inside the fork succeeds), pins the
`allowBuilds` set for pnpm ≥ 10 (without `workerd`, wrangler cannot start), ships a
standalone `tsconfig.base.json`, and drops `prepack`. Drift is a failing gate:
`--check` exports into a scratch directory and diffs against your local clones of
the repositories.

```bash
node scripts/export-deploy-repo.mjs                # write to --dest (default: ../hamolus-deploy-repos)
node scripts/export-deploy-repo.mjs --check --dest <clone-dir>   # fail if the clones have drifted
```

Anything in this page from "1. Resources" onward is the manual route the button
runs for you, with the caveat that a button deploy **cannot set secrets** — set
them after the first deploy (section 2).

## Order of deployment

1. **core** — the API Worker (D1 + KV + R2 bindings)
2. **console** — static assets on a Worker (admin UI)
3. **panels** — static sites, one per panel (optional)
4. **mcp** — a Worker exposing the core to AI agents (optional)

## 1. Resources

```bash
wrangler d1 create hamolus
wrangler kv namespace create hamolus
wrangler r2 bucket create hamolus-media
```

Paste the printed `database_id` and KV `id` into the core's `wrangler.jsonc`. The
committed file carries placeholder ids on purpose (`00000000-…`) so no real
resource is in the repository.

`hamolus add configuration <name>` does this for you and additionally creates a
deployable preset under `configs/<name>/`.

## 2. Secrets

Credentials are **secrets**, never vars — a secret and a var cannot share a name.

```bash
pnpm -F @hamolus/core exec wrangler secret put JWT_SECRET
pnpm -F @hamolus/core exec wrangler secret put ADMIN_KEY
```

Optional:

| Secret | Purpose |
| ------ | ------- |
| `PANEL_ASSET_SECRET` | HMAC key for private panel asset URLs; falls back to `JWT_SECRET` |
| `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` | first platform super-admin, seeded when `_auth_users` is empty |

## 3. Deploy the core

```bash
pnpm -F @hamolus/core deploy                 # the core package itself
pnpm -F ./configs/<name> deploy              # a named configuration
```

A configuration's `main` points back at the core part (`../../core/src/index.ts`),
so a single codebase is deployed to several environments or lands by adding
configuration files. Its `main` never points at `node_modules`.

Verify a configuration before deploying — it reports unresolved placeholders:

```bash
node configs/<name>/verify.mjs
```

After deploying, create the super-admin with the secrets above, then sign in to the
console with that account.

## 4. Console

The console is a static Vite/SolidJS SPA deployed as Worker **static assets**:

```jsonc
"assets": {
  "directory": "./dist",
  "not_found_handling": "single-page-application"
}
```

```bash
pnpm -F @hamolus/console build
pnpm -F @hamolus/console deploy
```

`single-page-application` makes every unknown path return `index.html` so the client
router can resolve it. Requests to static assets are free and unlimited.

Serve it from the domain **root**, and leave Vite's `base` at `/`: because every
unknown path is rewritten to `index.html`, a deep link like `/collections/posts`
must still find `/assets/…`, which only root-absolute URLs do. A relative base
would resolve against `/collections/` and 404. A generated console
(`hamolus add console`) ships the same `assets` block, and its `vite.config.ts`
documents what to change if you ever front it under a prefix instead.

In development the console proxies `/api` to the core (one origin, no CORS
preflight). Once deployed it calls the core cross-origin, which the core allows on
`/api/*` (`cors()`), so no extra configuration is needed.

## 5. Panel apps

`hamolus add panel <name>` generates a static Vite app under `panels/<name>/` with
its own `package.json` (a workspace member of the generated project). Build it like
any static site:

```bash
pnpm -F ./panels/<name> build
```

The output is a plain SPA in `dist/` — host it on Cloudflare Pages, or any static
host. Point it at the core with the panel client's config (see
[Panels](../packages/panel/docs/panels.md)); panel apps call the core directly and
therefore rely on the same `/api/*` CORS allowance.

## 6. MCP server

```bash
pnpm -F @hamolus/mcp build
pnpm -F @hamolus/mcp deploy
```

Configure the URL, credentials and (optional) land through the variables in
[the MCP reference](../packages/mcp/docs/mcp.md). For an open deployment put an
`MCP_BEARER_TOKEN` in front of it.

## Post-deploy checks

```bash
pnpm check:scope-colony-resolution
pnpm check:panel-acl            # needs a running core
pnpm check:code-defined-core    # needs a core generated from the basic template
```

Both target the local core by default; point them at a deployment with `BASE=` and
`ADMIN_KEY=` (see `packages/core/scripts/check-*.mjs`). `check:code-defined-core` refuses a
non-loopback `BASE` on purpose — it registers and deletes a land, a colony and a collection.

## Notes

- `PUBLIC_GETS` is `vars`, not a secret. `true` lets an independent core serve
  unauthenticated `GET`s; every multi-tenant mode uses `false`.
- The D1 and KV placeholders are intentional in `packages/*`: a fresh configuration
  warns instead of deploying against a resource that does not exist. They are
  dropped only by the export (section 0), never by hand in the monorepo.
- Nothing in the repository contains a real Cloudflare resource id, secret or
  credential.
