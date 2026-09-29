---
name: hamolus-config
description: Use ONLY when configuring a Hamolus project across core.config.ts, console.config.ts, KV settings, config entries, or Wrangler vars/secrets. Knows strict schemas, the KV-wins localization precedence, and the review-vs-no-redeploy decision. Front-load keywords: core.config.ts, defineCoreConfig, KV settings, config entry, PUBLIC_GETS, CORE_MODE.
---

# Hamolus — Config

Place a value on the right surface per `docs/definitions/config-definition.md`. Rule: **needs a PR → file. No deploy → KV/config entry. Credential/binding → Wrangler.**

## When to use

User says: set config, add locale, change site name, PUBLIC_GETS, CORE_MODE, env, settings, config entry. NOT for collections/fields/panels.

## The five surfaces

| Surface | Location | Needs deploy | Notes |
| ------- | -------- | ------------- | ----- |
| `core.config.ts` | core repo root | yes | `.strict()`; today only `localization` |
| `console.config.ts` | console root | yes | `.strict()`; exactly one property: `plugins` (default `[]`) |
| KV settings | Cloudflare KV `settings:{land}:{colony}:v1` | no | Free-form JSON; only key core reads is `localization`; `GET/PUT /_meta/settings` |
| Config entries | `_configs` table via `/_config/{key}` | no | `.strict()` `configEntrySchema`; `key ^[a-z][a-z0-9._-]*$`; one row per `(land, colony, key)`, targeted with `?land=` / `?colony=` |
| Wrangler vars/secrets | `wrangler.jsonc`, `configs/*/wrangler.jsonc` | redeploy | Credentials are **secrets** (`JWT_SECRET`, `ADMIN_KEY`, `PANEL_ASSET_SECRET`, `SUPER_ADMIN_*`); vars: `PUBLIC_GETS`, `CORE_MODE`, `DEFAULT_LAND`, `DEFAULT_COLONY` |

## Localization (only overlap)

- `core.config.ts`: `{ defaultLocale, locales[] }`; `defaultLocale` must be a declared locale. `defineCoreConfig()` validates at import and names the file on error.
- KV `settings.localization` **wins outright** (whole object, not per-locale merge).
- Read back: `GET /_meta/localization` → `{ data: null | { defaultLocale, multilingual, locales } }`; public under `PUBLIC_GETS=true`.
- No locales declared → `localized:true` field accepts plain string; console hides language switcher.
- Do **NOT** put `localization` in `console.config.ts` — strict schema rejects with `(root): Unrecognized key`.

## core.config.ts example

```ts
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

Wire: `core/src/index.ts` → `setCoreConfig(config)` before `setCodeDefinitions`.

## console.config.ts example

```ts
import { defineConsoleConfig } from '@hamolus/types'
import { todoPlugin } from '@hamolus/plugin-console-todo'

export const config = defineConsoleConfig({ plugins: [todoPlugin] })
export default config
```

`plugins` is the whole plugin system and the file's only property. `defineConsoleConfig({})` is valid ("no plugins"). Do **not** add `localization` here — it is strict-rejected.

## Decision test

- Locale set reviewed in PR → `core.config.ts`. Changed by operator today → KV `localization`.
- Site name/nav/UI copy/flags → KV settings.
- One addressable value fetched by key by frontend → config entry `scope: 'site'`.
- Credential → Wrangler secret. Resource id → Wrangler binding.
- Per-env override → named Wrangler configuration (`hamolus add configuration`).

## Checklist

- [ ] Value placed on correct surface (PR vs no-deploy vs credential)
- [ ] `core.config.ts` strict: only `localization`, valid codes, `defaultLocale` in list
- [ ] `console.config.ts` has no `localization`/`defaultLocale` leftovers
- [ ] If localized fields used, locales declared somewhere (file or KV)
- [ ] Secrets as secrets, not vars

## References

- `docs/definitions/config-definition.md`
- `packages/types/src/localization.ts`, `packages/core/src/config.ts`, `packages/core/docs/settings.md`
