# `examples/sites/astro/blog` — a static Astro blog

The smallest public site in `examples/`: a list page, a detail page, and a hand-written
REST client. It shows what a **fully static build** against a live core looks like, and
where that choice stops working.

## Not a workspace member

`examples/` is not in `pnpm-workspace.yaml`; this project installs on its own and has no
`@hamolus/*` dependency at all. The DTO types are declared locally on purpose — a site
should not pull in the API layer just to render a list.

```bash
pnpm install
cp .env.example .env          # PUBLIC_* values are inlined into the browser bundle
pnpm dev                      # astro dev
pnpm build                    # static output into dist/
pnpm preview
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/lib/hamolus.ts` | the REST client: origin normalisation, `listRecords`, `getRecord`, `getLocalization`, `HamolusApiError` |
| `src/lib/articles.ts` | the mapping from records to what a page renders |
| `src/layouts/Base.astro` | the shell, `<head>`, and the language switcher |
| `src/pages/index.astro` | the list page |
| `src/pages/blog/[slug].astro` | the detail page, with `getStaticPaths()` |
| `astro.config.mjs` | `output: 'static'`, `site: 'https://blog.example.com'` — **no adapter** |

## Invariants

- **Never send an `Authorization` header.** The core's auth middleware demands a valid
  JWT the moment that header appears, so sending it without a token breaks a request that
  would otherwise succeed. This site only reads public endpoints.
- **The articles collection must have a `public: true` view** on the core. `PUBLIC_GETS`
  is only ever true for a core created in `CORE_MODE=independent`; against any other mode
  every request answers `FORBIDDEN`, and no amount of front-end changes fixes it.
- **`PUBLIC_HAMOLUS_ORIGIN` has no trailing `/api`.** `apiBase()` appends it, and it
  handles both spellings. The `PUBLIC_` prefix means the value is inlined into the
  browser bundle — correct for a public core URL, wrong for anything secret.
- **The language list is the core's, not this file's.** `PUBLIC_HAMOLUS_LOCALE` only picks
  the language for a request; the full list comes from `GET /_meta/localization`. A local
  copy would offer a locale the core refuses on save.
- **`output: 'static'` means the data is frozen at build time.** Adding an article to the
  core does not change the deployed site until it is rebuilt. If that stops being
  acceptable, add an adapter here and switch `output` — do not start hand-rolling a
  fetch inside a component, and do not move data fetching into a layout.
- **Types are local, and that is a decision, not an oversight.** They mirror
  `packages/types/src/dto.ts` in the repository. If you change a DTO shape here, the file
  header is where the note belongs.
- Errors throw as `HamolusApiError` carrying `status` and `code`, so `getStaticPaths()`
  can tell "no such slug" (skip it) from "the core is down" (fail the build).
- `filter` goes out as a JSON string and `URLSearchParams` does the encoding. Never
  assemble a query string by hand.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`. Note that `.astro` files are **not** covered
  by that gate today, so put the notice where you can, but do not assume a check will
  catch its absence.
- Comments are English, and the "three rules" header in `src/lib/hamolus.ts` is the model
  to copy: say what the file holds to and why.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
