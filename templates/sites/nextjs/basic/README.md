# {{SITE_ID}}

A **Next.js App Router** site for **{{PROJECT_LABEL}}**, reading its content from the
Hamolus core, with the Next cache as a second layer.

Generated from `hamolus add site {{SITE_ID}}`. The shape it shows: a technical blog on a
domain of its own, for a team that
prefers `generateMetadata` for Open Graph and has a webhook that calls the revalidation
endpoint every time an article goes live.

## What it demonstrates

- **`fetch` with `next: { revalidate, tags }`.** The core response is reused for
  `HAMOLUS_REVALIDATE_SECONDS`, then fetched again in the background.
- **A cache tag per collection** (`hamolus:articles:published`), so one collection can be
  revalidated without taking the others along.
- **`revalidateTag()` from a Route Handler** in `src/app/api/revalidate/route.ts`, so a new
  article does not have to wait out the cache. The token is compared in constant time.
- **`generateStaticParams` for the routes, `getRecord(id)` for the detail.** The detail is
  not fetched a second time just so `generateMetadata` has a title.
- **`dynamicParams = false`.** A slug that is not in the list means 404, not a render that
  tries to fetch the data again.
- **The layout fetches nothing.** A layout that calls the core makes every page depend on
  the core being available — including pages whose data is already cached.

## Prerequisites

An `articles` collection in the core with the fields: `title`, `slug`, `excerpt`, `body`,
`cover`, `tags`, `author_name`, `published_at`, `status`.

## Running it

```bash
cd ../.. && pnpm dev          # the {{PROJECT_LABEL}} core

cd sites/{{SITE_ID}}
cp .env.example .env.local      # HAMOLUS_REVALIDATE_TOKEN needs a value too
pnpm install
pnpm dev                        # http://localhost:3000
```

`HAMOLUS_API_ORIGIN` is read on the **server**, so `localhost` means localhost on the
machine running Next. To test from a phone, start Next with `--hostname 0.0.0.0`;
`allowedDevOrigins` in `next.config.mjs` already allows `{{DEV_HOST}}`.

## Triggering revalidation

Drop one cache tag, or all of them at once.

```bash
# Published article list: tag hamolus:articles:published
curl -X POST http://localhost:3000/api/revalidate \
  -H "x-hamolus-token: $HAMOLUS_REVALIDATE_TOKEN"

# A single article: tag hamolus:articles:detail:<id>
curl -X POST http://localhost:3000/api/revalidate \
  -H "x-hamolus-token: $HAMOLUS_REVALIDATE_TOKEN" \
  -H "content-type: application/json" \
  -d '{"id":"article-2026-04-01"}'
```

The body is optional. Without `id`, the endpoint drops the list tag; with `id`, only that
detail page is dropped, so a webhook for a different article does not take the list with it.
`id` is validated against `^[A-Za-z0-9_-]{1,64}$` and rejected with `INVALID_ID` when it is
not safe — the tag name doubles as a cache key, so an id containing spaces or `/` must never
reach it.

The response always names the tag that was actually dropped, so a webhook can be logged:

```json
{ "data": { "revalidated": "hamolus:articles:detail:article-2026-04-01" } }
```

When `HAMOLUS_REVALIDATE_TOKEN` is not set, the endpoint answers 503 — not 403, because the
mistake is in the configuration, not a refusal. A wrong or missing token answers 403, and the
comparison is constant time so the duration does not leak the token's contents.

## Static or dynamic

| Page | Mode | Why |
| --- | --- | --- |
| `/` | `force-dynamic` | the article list has to follow the Next cache, not the build output |
| `/blog/[slug]` | static with `dynamicParams = false` | the routes are bounded and already known |

`hamolus add site {{SITE_ID}} --template astro` uses `getStaticPaths` for the same thing, and a new article there only
appears after a build. In Next, `revalidate` plus tags turns invalidation into an event
rather than something to wait for.

## Production notes

- `pageSize: 20` in `listPublishedArticles`. The core limit is 100, so if this blog grows,
  add pagination — do not just raise the number.
- `next/image` is not used so this template needs no `images.remotePatterns`. For production,
  add the core media domain to `images` in `next.config.mjs`; without that, images are still
  downloaded as-is and not optimised.
- `renderMarkdown` in `src/lib/markdown.ts` is a minimal renderer. Before using it for
  content from untrusted authors, replace it with `marked` plus `sanitize-html`, or let the
  core render the HTML.
- `revalidateTag` in Next 15 can only be called from inside a Route Handler or a Server
  Action. Calling it from a component fails — that is a Next limit, not a core one.
