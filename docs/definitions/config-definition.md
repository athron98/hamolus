# Config definition

Hamolus has four configuration surfaces, and choosing the wrong one is the most
common source of confusion in a project. The rule is short:

> **A value that should be reviewed in a pull request goes in a config file.
> A value an operator must change without a redeploy goes in KV settings or a
> config entry. A value that is a credential or a binding goes in Wrangler.**

| Surface | Where | Changed by | Needs a deploy | Schema |
| ------- | ----- | ---------- | -------------- | ------ |
| `core.config.ts` | the core's repo root | a commit | ✅ | `coreConfigSchema` — `.strict()` |
| `console.config.ts` | the console's root | a commit | ✅ | `consoleConfigSchema` — `.strict()`, currently empty |
| KV settings | Cloudflare KV, key `settings:{land}:{colony}:v1` | the console's **Config** page, or `PUT /api/_meta/settings` | ❌ | free-form JSON |
| Config entries | the `_configs` table, via `/api/_config` | the console's **Config** page, or `PUT /api/_config/{key}` | ❌ | `configEntrySchema` — `.strict()` |

Wrangler bindings, vars and secrets are the fifth surface and are documented in
[Deploying](../../docs/deploying.md) — they are listed at the end of this page
because they are infrastructure, not configuration.

## Precedence

For anything both `core.config.ts` and KV settings can express — today, only
localization — **KV settings win outright**:

```
KV settings  ──(valid localization?)──▶ wins, whole object
core.config.ts ─────────────────────▶ used when settings declare nothing
default                            ─▶ used when neither does
```

The merge is deliberately **not per-locale**. A settings blob that declares
`localization` replaces the file's list entirely, so an operator adding a locale
does not get a stale list merged underneath. The merge lives in
`mergeLocalization()` — `packages/types/src/localization.ts` — and every
consumer goes through it, which is why the core and the console can never
disagree about the locale list.

## `core.config.ts`

Build-time project settings, bundled into the Worker. A change needs a deploy,
which is the point: these are decisions you want to see in a code review.

```ts
// core.config.ts
import { defineCoreConfig } from '@hamolus/types'

export const config = defineCoreConfig({
  localization: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'id', label: 'Bahasa Indonesia' },
    ],
  },
})

export default config
```

```ts
// core/src/index.ts
import app, { setCoreConfig } from '@hamolus/core'
import { config } from '../core.config'

setCoreConfig(config)

export default app
```

### `CoreConfig`

`.strict()` — one property today, and an unknown key is an error rather than a
silently ignored typo.

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `localization` | `LocalizationConfig` | | Omit for a monolingual project. |

`defineCoreConfig()` validates at import time and throws with the file name in
the message, so a bad config fails the build rather than the first request.

### `LocalizationConfig`

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `defaultLocale` | `string` | ✅ | Must be one of `locales[].code`. |
| `locales` | `LocaleDefinition[]` | ✅ | 1–50. |

`LocaleDefinition`:

| Property | Type | Required | Notes |
| -------- | ---- | -------- | ----- |
| `code` | `string` | ✅ | BCP-47-shaped: `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$` — `en`, `id`, `pt-BR`, `zh-Hant`. |
| `label` | `string` | | `trim()`, 1–60. Human name for the switcher; falls back to the code. |
| `direction` | `'ltr' \| 'rtl'` | | Text direction. |

The refine that `defaultLocale` must be a declared locale is what makes a
`{ en, id }` value a **validation error** on a project that only declares `en`,
rather than something discovered after the first row is written.

### Why localization is a deployment decision

Localization is declared up front for two reasons:

1. The core validates a localized record **before** the first row is written, so
   a wrong locale never reaches storage.
2. The console renders a language switcher without probing settings first.

KV settings can still override the block at runtime, so an operator can add a
locale without a redeploy. The file is the starting point; the merge is
one-directional.

### Reading it back

`GET /api/_meta/localization` returns the effective value — the file's, or the
settings' when they override it — so no client has to mirror the list:

```jsonc
{
  "data": {
    "defaultLocale": "en",
    "multilingual": true,
    "locales": [{ "code": "en", "label": "English" }, { "code": "id", "label": "Bahasa Indonesia" }]
  }
}
```

`data` is `null` when the project declares no locales. The endpoint needs
`settings.read`, and is public under `PUBLIC_GETS=true` so a frontend can resolve
its language before signing in.

### A project with no locales

`locales: []` is rejected — the array needs at least one entry — but omitting the
whole `localization` block is valid, and that is the monolingual case. The
consequence matters:

> A project with no locales stays monolingual, and a `localized: true` field then
> accepts a **plain string**.

Declaring zero languages must not make localized fields stricter than a
non-localized project. The console simply hides its language selector.

### Runtime helpers

`packages/core/src/config.ts` owns the merge:

| Function | Returns |
| -------- | ------- |
| `setCoreConfig(config)` | Applies the file config. Idempotent. |
| `getCoreConfig()` | The config in effect — for tests and diagnostics. |
| `configuredLocalization()` | The file's localization, normalized. |
| `effectiveLocalization(settings)` | File + settings, settings winning. |
| `effectiveLocaleCodes(settings)` | The codes record validation must accept. |

## `console.config.ts`

Host-level console settings, bundled into the page. It is `.strict()` and has
**exactly one property today** — `plugins`, defaulting to `[]`:

```ts
export const consoleConfigSchema = z
  .object({
    plugins: z.array(consolePluginSchema).default([]),
  })
  .strict()
```

That single property is the whole plugin system. A host lists its plugin
descriptors here, `hamolus add plugin` appends to the array, and
`mount({ config })` hands the list to the console, which registers them before
the first render. The console ships as a Vite bundle, so a second registry file
the host had to edit would be a file the host does not own and cannot re-generate.

`plugins` is optional on the way in — `defineConsoleConfig({})` is valid and
means "no plugins" — and always present after validation. `ConsoleConfigOptions`
and `ConsoleConfigInput` are separate types for exactly that reason.

What is deliberately *not* here is localization, and the reason is worth stating
because it is the kind of decision that gets undone by accident:

- Localization is configured once, in the core, and every consumer follows the
  core automatically: the console asks `GET /_meta/localization`, and
  `@hamolus/panel` exposes the same answer through
  `PanelClient.getLocalization()`.
- Mirroring the list in a console config would give the project two places to
  edit, only one of which changes what the core validates. A stale console copy
  would offer a locale that then fails to save.

So the file is reserved for concerns that are genuinely the **host's** — which
plugins a console ships, which endpoints it offers first — anything that is a
property of *this deployment* rather than of the project.

```ts
// console.config.ts
import { defineConsoleConfig } from '@hamolus/types'
import { kanbanPlugin } from '@hamolus/plugin-console-kanban'
import { todoPlugin } from '@hamolus/plugin-console-todo'

export const config = defineConsoleConfig({
  plugins: [todoPlugin, kanbanPlugin],
})

export default config
```

Because the schema is strict, a leftover `localization` or `defaultLocale` key
from an older template fails loudly here instead of being ignored:

```
console.config.ts is invalid — (root): Unrecognized key: "localization"
```

A console's **name, navigation, theme copy and locales are not console config** —
they are the core's settings, read at runtime.

## KV settings

A single free-form JSON object in Cloudflare KV, keyed per scope as
`settings:{land}:{colony}:v1` (the root scope keeps the legacy `settings:v1` key
so pre-scope blobs keep working). This is the config bucket for anything that
should not require redeploying a Worker or a D1 table: site name, navigation, UI
copy, feature toggles, third-party keys for frontends.

| Method | Endpoint | Permission | Behaviour |
| ------ | -------- | ---------- | --------- |
| `GET` | `/_meta/settings` | `settings.read` | The whole blob. |
| `PUT` | `/_meta/settings` | `settings.write` | Shallow-merges the body over the blob, persists, returns the merged result. |

```bash
curl -X PUT http://localhost:8787/api/_meta/settings \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"site":{"name":"Acme","navigation":[{"label":"Home","href":"/"}]}}'
```

The body must be a JSON **object**; nothing inside it is validated against a
fixed schema, so the shape is a convention the project defines. The only key the
core itself reads is `localization`. The recommended shape:

```jsonc
{
  "localization": { "defaultLocale": "en", "locales": [{ "code": "en" }] },
  "site": {
    "name": "Worker Stacks",
    "tagline": "A Cloudflare Workers monorepo.",
    "navigation": [{ "label": "Home", "href": "/" }]
  }
}
```

Both endpoints need a JWT by default. `PUBLIC_GETS=true` does **not** open
them — that flag only opens `GET` on record endpoints. A frontend calling
settings from the edge passes its token like any other request.

Full reference: [KV settings](../../packages/core/docs/settings.md).

## Config entries

Key/value rows in the internal `_configs` table, one row per **colony** per key, for
values that are individually addressable — the shape to reach for when settings'
free-form blob is not enough.

| Method | Endpoint | Permission | Behaviour |
| ------ | -------- | ---------- | --------- |
| `GET` | `/_config` | `config.read` | List what the session may see. `?land=` = every colony of that land, `?colony=` = one colony, neither = everything reachable. |
| `GET` | `/_config/{key}` | `config.read` | One entry. A land-scoped session must add `?colony=`. |
| `PUT` | `/_config/{key}` | `config.write` | Upsert. The body's `key`, if present, must match the path. |
| `DELETE` | `/_config/{key}` | `config.write` | Delete → `204`. |

```jsonc
// PUT /api/_config/site.theme?colony=kitchen_cny
{
  "value": { "mode": "dark", "palette": "blue" },
  "description": "Public appearance"
}
```

`configEntrySchema`:

| Property | Type | Required | Default | Notes |
| -------- | ---- | -------- | ------- | ----- |
| `key` | `string` | ✅ | — | `^[a-z][a-z0-9._-]*$`, max 100. Bound as a parameter, never as an SQL identifier. |
| `value` | `unknown` | ✅ | — | Arbitrary JSON. |
| `description` | `string \| null` | | | `trim()`, max 255. |

`.strict()` — unknown keys are rejected. A `PUT` whose body does not match the
path key is `400 VALIDATION`, and a body still carrying the removed `scope` field is
rejected the same way rather than ignored.

The response carries the row's own `land` and `colony`, so a caller that asked for a land
can tell two colonies apart without a second request. On write, both come from the
target the request names: a colony session's own colony, a land session's `?colony=`,
and for a platform admin whichever it names.

Entries are **per colony**: the same key in two colonies is two rows with independent
values, and deleting a land or colony deletes its config with it.

What a session may reach follows the **scope** of its privilege — never the target in the
query, and never a role *name* (the default colony role is called `admin`, which says
nothing about how far it reaches). A land admin sees its whole land and must name a
colony to write; a colony admin sees only its own colony and gets `403` rather than a
silent narrowing when it asks for a sibling.

## Choosing a surface

| You want to change… | Use |
| ------------------- | --- |
| The set of locales, reviewed in a PR | `core.config.ts` |
| The set of locales, changed by an operator today | KV settings `localization` |
| Site name, nav, UI copy, feature flags | KV settings |
| One addressable value a frontend fetches by key | a config entry in that colony |
| A credential | a Wrangler secret |
| A resource id (D1, KV, R2) | a Wrangler binding in `wrangler.jsonc` |
| A per-environment override of any of the above | a named Wrangler configuration |

The decision test is one question: **does this need a code review, or does it
need to change without shipping?** A review → file. No deploy → KV or an entry.
Credentials and bindings never go in either.

## Wrangler vars and secrets

Not a `defineXConfig` schema, but part of the same picture, so here is the full
list. Credentials are **secrets**, never vars — a secret and a var cannot share
a name.

| Binding / var | Kind | Purpose |
| ------------- | ---- | ------- |
| `DB` | D1 binding | The database. |
| `SETTINGS` | KV binding | The settings blob, keyed `settings:{land}:{colony}:v1`. |
| `MEDIA` | R2 binding | Media objects. |
| `JWT_SECRET` | **secret** | Signs JWTs. |
| `ADMIN_KEY` | **secret** | Legacy admin login key. |
| `PANEL_ASSET_SECRET` | **secret**, optional | Signs private panel asset URLs; falls back to `JWT_SECRET`. |
| `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` | **secret**, optional | Bootstraps the platform super admin when `_auth_super` is empty. |
| `PUBLIC_GETS` | var | `'true'` opens record `GET` endpoints without a JWT. |
| `CORE_MODE` | var | `independent` (default), `centralized`, `proxy`, `bridge`. |
| `DEFAULT_LAND` | var | Land for unscoped requests. |
| `DEFAULT_COLONY` | var | Colony for unscoped and land-admin requests. |

```bash
pnpm -F @hamolus/core exec wrangler secret put JWT_SECRET
pnpm -F @hamolus/core exec wrangler secret put ADMIN_KEY
```

Named configurations — staging, production, one per land — live in
`configs/<id>/wrangler.jsonc` and are generated by `hamolus add configuration`.
One codebase, several environments, added as configuration files only. See
[Deploying](../../docs/deploying.md).

## Errors

| Code | Status | Cause |
| ---- | ------ | ----- |
| `VALIDATION` | 400 | A config entry failed `configEntrySchema`; the message names the path. |
| `SCOPE_REQUIRED` | 400 | A land-scoped session addressed a single entry without naming `?colony=`; the message names the parameter. |
| `SCOPE_MISMATCH` | 400 | `?land=` and `?colony=` were both given and the registry says that colony belongs to another land. |
| `FORBIDDEN` | 403 | Missing `config.read` / `config.write` or `settings.read` / `settings.write`, or a target outside what the privilege's scope reaches. |

A bad `core.config.ts` or `console.config.ts` does not produce a 400 — it throws
at import, naming the file:

```
core.config.ts is invalid — locales.0.code: Locale code must look like "en" or "pt-BR"
```

## Extending configuration

`coreConfigSchema` and `consoleConfigSchema` are both `.strict()` and both
intentionally small. When you add a property:

1. Add it to the schema in `packages/types/src/localization.ts` (or a new module
   re-exported from `packages/types/src/index.ts`).
2. Decide its precedence against KV settings explicitly, and implement the merge
   in `packages/core/src/config.ts` — never let a file value and a settings value
   be reconciled ad hoc at each call site.
3. Add the property to `templates/cores/*/core.config.ts` **as a commented
   example**, so a generated project discovers it.
4. Extend `packages/core/scripts/check-localization.mjs`, which already asserts
   that the console config rejects `localization` and that a bad core config
   names its file.
5. Document it here and in `packages/core/docs/settings.md`.

## See also

- [KV settings](../../packages/core/docs/settings.md) — the settings blob in
  full.
- [Deploying](../../docs/deploying.md) — bindings, secrets, configurations.
- [Collection definition](./collection-definition.md) — how `localized` fields
  consume the locale list.
- [Architecture](../../packages/core/docs/architecture.md) — `CORE_MODE` and
  scope resolution.
