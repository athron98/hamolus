# sites/astro/corporate

A corporate site built with **Astro**: a company profile and team pages, built as one URL
per locale.

Example domain: a company registered in two countries. Editors manage the profile and the
team from the console, the site is rebuilt periodically, and every language has its own URL.

## What it demonstrates

- **The language list belongs to the core, not to the site.** The public
  `GET /_meta/localization` reports which locales exist, and `getStaticPaths` iterates them.
  Adding a language in the core is all it takes to add pages — there is no list in this repo
  to edit.
- **`getStaticPaths` then `getRecord(id)`.** `getStaticPaths` only fetches the list to decide
  which routes get built; the detail is fetched per page through
  `GET /api/{collection}/{id}`. Fetching the detail in `getStaticPaths` too would read one
  record twice.
- **One list request per locale, not one per row.** 12 team members × 2 languages come to two
  list requests, not 24 detail requests.
- **Unconfigured locales degrade gracefully.** If the core has no localization yet,
  `effectiveLocales()` returns the single locale from the environment and the site still
  builds.
- **An empty collection ≠ a failed build.** The profile page shows an explanation rather
  than throwing.

## Prerequisites

Two collections in the core:

| Collection | Fields |
| --- | --- |
| `companies` | `name`, `tagline`, `about`, `address`, `email` — a single row |
| `team_members` | `name`, `role`, `bio`, `photo`, `email`, `order` |

Localization is configured in the **core**: `core.config.ts`, or the Config → Localization
screen in the console. To try it out, insert
`localization: { defaultLocale: 'en', locales: [{ code: 'en' }, { code: 'id' }] }` into
`core.config.ts` and restart the core.

## Running it

```bash
cd /path/to/acme && pnpm dev   # replace with the path to your own core project

cd examples/sites/astro/corporate
cp .env.example .env
pnpm install
pnpm dev              # http://localhost:4322
```

The result:

```
/en/            /id/
/en/about/      /id/about/
/en/people/<name>/   /id/people/<name>/
```

## About putting people's names in URLs

`[slug].astro` uses `member.name` as the route parameter. That is a deliberate choice to
keep the example short, and the wrong choice for production: a name can contain spaces, can
change, and need not be unique. Use a separate `slug` field in the collection instead, and
let `getStaticPaths` map it — the blog example already shows that pattern.

## Production notes

- `trailingSlash: 'always'` in `astro.config.mjs` is deliberate, because the language URLs
  are path-prefixed. Change it and the canonical URL on every page changes with it — and two
  addresses for one page are two separate problems, not one.
- Team member photos are fetched from the public `/media/...` URL. If a photo has to stay
  private (an internal portfolio, say), the `GET /api/{collection}/{id}` endpoint will not
  return it; use a signed URL as in
  [`../../../panels/booking-kalendar`](../../../panels/booking-kalendar).
- Adding a language in the core adds pages and URLs at the same time. For things like
  `hreflang`, write the tags in the `Base.astro` layout from the same locale list.
