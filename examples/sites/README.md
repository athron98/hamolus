# sites

Example **sites and apps that read Hamolus data**.

This group differs from `panels/` and `consoles/` in one way that determines everything in
the folder: the content is read straight from the core's REST API, with neither
`@hamolus/panel` nor `@hamolus/console`.

```
GET {API_BASE}/{collection}?page=1&pageSize=20&locale=id&filter={...}
```

`API_BASE` always ends with `/api`, and the query is `strict` — an unknown key is rejected
with `INVALID_QUERY` instead of being silently ignored.

## No token

While `PUBLIC_GETS` is still `true` on the core (the default), a `GET` without an
`Authorization` header is let through. There is one trap that has to be understood properly:

> The core's auth middleware demands a valid JWT as soon as an `Authorization` header
> appears, so `PUBLIC_GETS=true` no longer rescues that request.

So if a site has no token, **never send that header at all** — not an empty header. Writing
from a site (checkout, comments, user sign-in) is not part of reading public content: it
needs its own authentication, or a panel that manages it.

## Response shape

```jsonc
// GET /api/articles?page=1&pageSize=20
{
  "data": [ /* records as defined by the collection */ ],
  "meta": { "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 },
  "lastUpdate": 1735689600000   // hash; used for revalidation
}
```

A single record is `GET /api/articles/{id}` with the shape `{ "data": { ... } }`.
A failure is `{ "error": { "code": "NOT_FOUND", "message": "..." } }` with a non-200 status.

## What is here

| Path | Stack | What it demonstrates |
| --- | --- | --- |
| [`astro/blog`](astro/blog) | Astro | SSG + Markdown, `getStaticPaths` from core data |
| [`astro/corporate`](astro/corporate) | Astro | one record per page, multi-locale |
| [`astro/ecommerce`](astro/ecommerce) | Astro | filters and pagination as URLs |
| [`nextjs/blog`](nextjs/blog) | Next.js | App Router, streaming, `revalidateTag` |

## Why each example rewrites the client

`src/lib/hamolus.ts` is repeated in all four examples. That is deliberate: each one has to
be copyable into its own project and runnable without any package from this repo. If it
were extracted into one shared package, the examples would stop being self-contained
references you can read on their own.

The shape is deliberately kept small: one `request` function, one local set of types, no
dependencies.

## If you need an official SDK

There is not one yet. `PanelClient` is locked to the panel endpoints and always needs a
token, while the console's `api.ts` is not exported. For public content, writing your own
client is smaller than taking on a dependency — which is exactly what these examples show.
