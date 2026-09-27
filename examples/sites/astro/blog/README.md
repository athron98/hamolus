# sites/astro/blog

A static **Astro** blog whose articles are read from the Hamolus core at build time.

Example domain: a technical blog from a small team that writes from the console while the
site rebuilds itself every time an article goes live.

## What it demonstrates

- `GET /api/articles` at build time, with a `filter` for `status = published` and
  `sortBy=published_at&sortDir=desc`.
- `GET /api/articles/{id}` for the detail. The core route uses the **id**, not the slug;
  `slug` is only there for the URL, and `getStaticPaths` bridges the two.
- **Build failures that tell the truth.** If the core cannot be read, `getStaticPaths`
  throws an error with an actionable message rather than producing an empty output
  directory with no explanation.
- **Markdown rendered at build time**, with escaping applied before any tag is wrapped. The
  note in `src/pages/blog/[slug].astro` spells out what has to hold if the renderer is
  ever replaced.

## Prerequisites

An `articles` collection in the core with the fields: `title`, `slug`, `excerpt`, `body`,
`cover`, `tags`, `author_name`, `published_at`, `status`.

The collection can be created from the console, or straight from the API:

```bash
curl -s http://localhost:8787/api/_meta/collections -H "authorization: Bearer $TOKEN" | jq
```

## Running it

```bash
# 1. the core, in another terminal
cd /path/to/acme && pnpm dev   # replace with the path to your own core project

# 2. the site
cd examples/sites/astro/blog
cp .env.example .env
pnpm install
pnpm dev            # http://localhost:4321
pnpm build && pnpm preview
```

`PUBLIC_HAMOLUS_ORIGIN` has to point at a core the **build machine** can reach. If the build
runs on a laptop and the core is on that same laptop, `localhost` is right; if the build
runs in CI, `localhost` points at the runner itself.

## Static or server

This example is `output: 'static'`, so:

- a new article only shows up after the next build;
- the built HTML does not change until the next build.

If the blog needs pages that are always fresh, there are two ways:

| Option | Change | Trade-off |
| --- | --- | --- |
| Periodic builds | a webhook from the console, or cron | history is one HTML file per article; cheap hosting |
| `output: 'server'` + adapter | add an adapter, only `astro.config.mjs` changes | on-demand is possible, but it needs a runtime |

Those changes only touch the config. Fetching still works on whatever host runs the build,
so `PUBLIC_HAMOLUS_ORIGIN` has to point at a core reachable from wherever the build runs.

## Production notes

- `pageSize: 50` in `listPublishedArticles` is still under the limit of 100, so 50 articles
  per build. For a larger blog, paginate in `getStaticPaths` — iterate page by page instead
  of raising `pageSize`.
- `getLastUpdate()` in `src/lib/hamolus.ts` is there to decide whether a rebuild is worth
  it. Pair it with `hamolus add seed` or a console hook to trigger the build.
- Images from `cover` are fetched from the public URL (`/media/...`), so they need no
  token. Private panel assets cannot be used here — see `getPanelAssetUrl()` in
  [`../../../panels/booking-kalendar`](../../../panels/booking-kalendar).
