# `examples/sites/astro/ecommerce` — a paginated static catalog

The build-time-pagination example: two dynamic route segments, a page count read from the
core, and a shared view component. It exists to show what a static site has to get right
when it freezes a paginated collection at build time.

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
| `src/lib/hamolus.ts` | the REST client |
| `src/lib/catalog.ts` | the collection, `PAGE_SIZE`, `MAX_PAGES`, category helpers |
| `src/components/CatalogView.astro` | the shared template: `/` for every product, and `/c/{category}/{page}` for a filtered page |
| `src/pages/index.astro` | page 1 of everything |
| `src/pages/c/[category]/[page].astro` | one page per category per page number |
| `astro.config.mjs` | `output: 'static'`, `site: 'https://shop.example.com'` |

## Invariants

- **The `pageSize` used to count must be the `pageSize` used to render.** `meta.totalPages`
  is `total / pageSize`; counting with `pageSize: 1` to make the response small produces
  a page count from a different division, and you get empty pages. This is the single
  most important rule in this example.
- **The page count is capped by `MAX_PAGES`, firmly.** A core holding many products would
  otherwise ask the build to emit tens of thousands of pages. Raising the cap is a
  deliberate decision, not a fix for a missing product.
- **Anything a `getStaticPaths()` module uses must be an `import`.** Astro carries only
  the imports and the function body into its `getStaticPaths` module, so a `const`
  declared in the page frontmatter is *not* available there. This is why `PAGE_SIZE` lives
  in `src/lib/catalog.ts`.
- **One URL per content.** Page 1 without a category is `/`; page 1 *with* a category is
  `/c/{slug}/{1}` — the page number is not dropped for a category, because dropping it
  would give the same content two addresses. `pageUrl()` is the single place that decides
  this; do not build a path inline anywhere else.
- **Every pagination link must point at a page that was built.** A link to
  `totalPages + 1` is a 404 with no explanation, so the link list is clamped to the same
  cap `getStaticPaths` used.
- **A core with no products still builds.** `getStaticPaths()` returns an empty path list
  and `/` still renders. Do not make the build depend on there being data.
- **Filtering works through fixed category slugs, not arbitrary query strings.** That is
  what keeps `output: 'static'` possible. If you need arbitrary filters, switch to
  `output: 'server'` and add an adapter — do not try to build a path per possible filter.
- **Never send an `Authorization` header**, and the products pages must be `public: true`
  on the core. `PUBLIC_GETS` is only true for `CORE_MODE=independent`.
- `PUBLIC_HAMOLUS_ORIGIN` carries no trailing `/api`; `apiBase()` appends it. The
  `PUBLIC_` prefix inlines the value into the browser bundle.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`. `.astro` files are not covered by that gate
  today.
- Comments are English; the page-count and `pageSize` rules above are the model, and they
  belong next to the code that could break them.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
