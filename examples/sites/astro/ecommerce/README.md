# sites/astro/ecommerce

A product catalog built with **Astro**, filtered and paginated from the Hamolus core.

Example domain: a shop whose products are managed from the console, with categories and
catalog pages that need their own URL so they can be shared and indexed.

## What it demonstrates

- **`FilterMap` all the way to the core.** Filters are sent as JSON:
  `{ status: { op: 'eq', value: 'active' }, price: { op: 'lte', value: 500000 } }`.
  Available operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `in`, `contains`.
- **Pagination comes from `meta`, not from `data.length`.** The response always carries
  `meta.totalPages`; deriving it yourself from the result count is always wrong on the last
  page.
- **Routes are split so the URL really has a file behind it.** `/` for every product on
  page 1, `/c/{category}/{page}` for a category and page combination. The combinations
  cannot live in `index.astro`: `getStaticPaths` only sets `params` on a route with dynamic
  segments, so all of them would pile up in one `index.html` — green build, dead URLs.
- **`getStaticPaths` only builds the pages that hold data.** The page count per category is
  read from `meta.totalPages` with the same `pageSize` as the render (`PAGE_SIZE`), then
  capped at `MAX_PAGES` 20. Unfiltered, 21 categories × 20 pages comes to 420 HTML files,
  most of them empty. Counting with a different `pageSize` — whose response is smaller —
  looks cheaper but is wrong: `totalPages` comes out of a different division, which produces
  empty pages labelled "page 2 of 1".
- **The `MAX_PAGES` cap applies to the links too.** If the core says 21 pages while
  `MAX_PAGES` is 20, the counter writes "page 20 of 20" plus a note that the core has 21
  pages and only the first 20 are built, and no link to page 21 is made. A link to a page
  that has no file behind it is worse than a counter that is too small: the reader lands on
  a 404 with no idea why. Raise `MAX_PAGES` if the catalog really is that big.
- **A category without a `slug` still gets an ASCII URL.** The name is simplified into a
  path segment, so the category `Sepatu Pria` becomes `/c/sepatu-pria/1/` rather than a
  path with spaces in it. If the core fills in a `slug`, that slug is what gets used — for
  pagination links too, not only for the route.
- **`formatPrice` tells `null` from `0`.** "Price to follow" is not "Free".

## Prerequisites

Two collections in the core:

| Collection | Fields |
| --- | --- |
| `products` | `name`, `slug`, `description`, `image`, `price`, `stock`, `category`, `tags`, `status` |
| `categories` | `name`, `slug` (optional) |

`status` holds `active` / `draft` / `archived`. Only `active` passes this example's filter.

## Running it

```bash
# 1. the core, in another terminal
cd /path/to/acme && pnpm dev   # replace with the path to your own core project

# 2. the site
cd examples/sites/astro/ecommerce
cp .env.example .env
pnpm install
pnpm dev              # http://localhost:4323
```

## Limits of static mode

This catalog is `output: 'static'`, so only the combinations that are **known at build
time** get a page:

| Combination | Built? |
| --- | --- |
| `/` | yes |
| `/c/sepatu/1/` | yes, if `Sepatu` is in `categories` |
| `/c/sepatu/2/` | yes, if that category's `meta.totalPages` is at least 2 |
| `/c/sepatu/21/` | no — `MAX_PAGES` is 20 |
| `/?q=sepatu` | no — it has no static page |
| `/?maxPrice=100000` | no |
| `/?inStock=1` | no |

The free-form filters (`q`, `maxPrice`, `inStock`) combine unbounded values, so they cannot
be counted at build time. `output: 'static'` produces no HTML for those combinations, and
`pnpm dev` does not help: the dev server renders `/` on demand, but the query string never
reaches a filter anywhere in this example's code. If those free-form filters are genuinely
needed, pick one:

| Option | Change | Trade-off |
| --- | --- | --- |
| `output: 'server'` plus an adapter | config only; `getStaticPaths` goes away, the catalog becomes SSR | URLs are always valid, but a runtime is needed |
| Restrict the filters to fixed values | the URL shape follows the values that are allowed | unbounded combinations become impossible |
| Make pagination part of the filter | no extra combinations | deeper URLs, and less pleasant to read |
| Filter on the client | `q`, `maxPrice`, `inStock` become JavaScript filters | still static, but only over data that was already downloaded |

For a catalog whose filters are fixed categories — not free-form search — static mode is
usually enough.

## What is not here, and why

- **Cart and checkout.** The public read endpoints do not write anything. Checkout needs
  authentication and idempotency, and that cannot be solved with
  `POST /api/{collection}` without a design of its own.
- **Per-variant pricing.** If the price depends on the variant (size, colour), a single
  `price` field is not enough — it takes a variants collection and an `in` filter, or a
  dedicated endpoint.
- **Totals.** The core computes `meta.total` and `lastUpdate`, not business aggregates. The
  cart total is computed on the application server, not in the core.
