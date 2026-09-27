# sites/astro

Three **Astro** site examples, each for a different shape of problem.

| Example | Focus | Mode |
| --- | --- | --- |
| [`blog`](blog) | list + detail, status filter, Markdown | `static` |
| [`corporate`](corporate) | one record per page, multi-locale, one URL per language | `static` |
| [`ecommerce`](ecommerce) | filters and pagination that become URLs | `static` |

## What all three share

- **Data is fetched at build time.** `PUBLIC_HAMOLUS_ORIGIN` has to point at a core the
  build machine can reach, not the `localhost` of whoever happens to be building.
- **A client of their own in `src/lib/hamolus.ts`**, with no dependencies. The reason is in
  [`../README.md`](../README.md): `PanelClient` is locked to the panel endpoints and always
  needs a token, while a site needs the public `GET /api/{collection}`.
- **No `Authorization` header.** It is deliberately never sent; the core's auth middleware
  demands a valid JWT as soon as that header appears.
- **`getStaticPaths` decides the routes, `getRecord` fetches the detail.** The detail is not
  fetched twice just so a page can have a title.

## What differs, and why

- **blog** is fully `output: 'static'`, so a new article only appears after the next build.
  If that is not acceptable, build on a schedule or move to SSR.
- **corporate** treats the core's language list as the source of its routes. Adding a
  language on the core automatically adds pages; there is no language list in this repo that
  can go stale.
- **ecommerce** only builds the filter combinations that contain data. Free-form search has
  no static pages — the limits of static mode are spelled out in its README.

## Running

```bash
# the core first
cd /path/to/acme && pnpm dev   # replace with the path to your core project

# then one of them
cd examples/sites/astro/blog      # http://localhost:4321
cd examples/sites/astro/corporate  # http://localhost:4322
cd examples/sites/astro/ecommerce  # http://localhost:4323
```

The ports differ so all three can run at the same time.
