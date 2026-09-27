# `examples/sites/astro/corporate` — a multi-locale Astro site

The i18n example. Routes are nested under `[locale]/`, and the **language list comes from
the core** — `getStaticPaths()` asks the core and iterates what it answers. It exists to
show the pattern for a site that must build one page per language without hardcoding
them.

## Not a workspace member

`examples/` is not in `pnpm-workspace.yaml`; this project installs on its own and has no
`@hamolus/*` dependency. The DTO types are declared locally on purpose.

```bash
pnpm install
cp .env.example .env
pnpm dev
pnpm build
pnpm preview
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/lib/hamolus.ts` | the REST client, plus `effectiveLocales()` — the core's list with a fallback |
| `src/lib/company.ts` | the mapping from records to pages, and the localisation helpers |
| `src/layouts/Base.astro` | the shell; takes `lang` and `locales` as props |
| `src/pages/[locale]/index.astro` | the home page, built once per locale |
| `src/pages/[locale]/about.astro` | a second page, same locale loop |
| `src/pages/[locale]/people/[slug].astro` | a detail page, built once per person **per locale** |

## Invariants

- **Never send an `Authorization` header.** The core's auth middleware demands a valid
  JWT as soon as that header appears, so sending it without a token breaks a request that
  would otherwise succeed. This site only reads public endpoints.
- **The core's language list wins; `PUBLIC_HAMOLUS_LOCALE` is only a fallback.** A core
  with no localization configured at all is a normal state, and then the fallback locale
  is used and **only** the fallback locale is built. `PUBLIC_HAMOLUS_LOCALE=en` is
  therefore not "the default language of the site" — it is what happens when the core has
  nothing to say.
- **Adding a language is a core change.** The site needs no edit and no local language
  array; a copy here would mean editing both, and a stale copy would offer a locale the
  core refuses on save.
- **The pages must have `public: true` views** on the core, and `PUBLIC_GETS` is only
  true for `CORE_MODE=independent`. In any other mode every request answers `FORBIDDEN`.
- **`[locale]` is a real path segment, not a query parameter.** A page served at one URL
  per locale means the fallback cannot be a redirect or an `Accept-Language` guess — the
  build decides which URLs exist.
- **A person page is built per locale, so a `slug` that does not exist in *any* locale is
  simply absent.** `getStaticPaths()` iterates locales and skips what the core refuses;
  it must not throw on a 404 for one locale.
- **Every linked page must be built.** A link to a `people/[slug]` that `getStaticPaths`
  never produced is a 404 with no explanation, so the slug list and the link list come
  from the same source.
- `PUBLIC_HAMOLUS_ORIGIN` carries no trailing `/api`; `apiBase()` appends it. The
  `PUBLIC_` prefix inlines the value into the browser bundle — correct for a public core
  URL, wrong for anything secret.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`. `.astro` files are not covered by that gate
  today.
- Comments are English; the "why" of the locale loop is the thing to document, not the
  loop itself.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
