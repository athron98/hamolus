# `examples/sites/nextjs/blog` — a server-rendered Next.js blog

The only server-side site in `examples/`. It reads the core from the server, caches the
responses, and exposes a webhook route so a publish in the console invalidates the cache
immediately instead of waiting out the revalidation window.

## Not a workspace member

`examples/` is not in `pnpm-workspace.yaml`; this project installs on its own and has no
`@hamolus/*` dependency. The DTO types are declared locally on purpose.

```bash
pnpm install
cp .env.example .env.local
pnpm dev      # next dev
pnpm build
pnpm start
```

## Layout

| Path | Holds |
| ---- | ----- |
| `src/lib/hamolus.ts` | the REST client: `listRecords`, `getRecord`, `HamolusApiError` |
| `src/lib/articles.ts` | the record shape, the article tag, and the cached access to it |
| `src/lib/markdown.ts` | markdown → HTML for the post body |
| `src/app/layout.tsx` | the shell and `<head>` |
| `src/app/page.tsx` | the list page |
| `src/app/blog/[slug]/page.tsx` | the detail page, with `generateMetadata` and `generateStaticParams` |
| `src/app/api/revalidate/route.ts` | the webhook that drops the article cache |

## The env split matters

- `HAMOLUS_API_ORIGIN` and `HAMOLUS_LOCALE` are **server-only** (no `NEXT_PUBLIC_`), and
  are read in Server Components, Route Handlers and `generateMetadata`. `localhost` there
  means localhost on the machine running Next — not on the reader's browser.
- `HAMOLUS_REVALIDATE_SECONDS` is how long Next may reuse a core response.
- `HAMOLUS_REVALIDATE_TOKEN` guards the revalidate route. No `NEXT_PUBLIC_` prefix, so it
  is not inlined into the browser bundle. Empty is a valid state: the endpoint replies
  503.

## Invariants

- **Never send an `Authorization` header.** The core's auth middleware demands a valid
  JWT the moment that header appears, so sending it without a token breaks a request that
  would otherwise succeed. This site only reads public endpoints.
- **The revalidate token is compared, not merely checked for presence.** `if (!token)`
  accepts an empty string, which would leave the route open to anyone. That, and replying
  503 when no token is configured, is the whole reason this file carries a header comment.
- **The webhook is not a reader's browser.** It exists for a hook from the console or CI;
  treat its input as untrusted and keep the comparison constant-time in spirit.
- **Cache invalidation goes through the tag, and the tag has to be the one the fetch
  used.** A `revalidateTag()` naming a tag nothing caches is a silent no-op — the symptom
  is a page that stays stale for `HAMOLUS_REVALIDATE_SECONDS` and no error anywhere.
- **The article pages need `public: true` views** on the core, and `PUBLIC_GETS` is only
  true for `CORE_MODE=independent`. Any other mode answers `FORBIDDEN`.
- **`generateStaticParams` and the fetch share the page size**, for the same reason the
  Astro catalog example documents it: `meta.totalPages` is `total / pageSize`.
- **A 404 from the core is a `notFound()`, not a 500.** `HamolusApiError` carries `status`
  and `code` precisely so those two are distinguishable.
- `HAMOLUS_API_ORIGIN` carries no trailing `/api`; `apiBase()` appends it.
- `tsconfig.tsbuildinfo` is committed in this example on purpose (it is a scaffold, and a
  fresh clone should build the same way). Do not "clean it up" in a way that changes what
  gets built.

## Conventions

- One-line copyright notice at the top of every source file — `pnpm check:copyright` from
  the repository root covers `examples/**`.
- Comments are English; the security and caching rules above are the model — each one
  states what breaks, not what the code does.
- Commit messages follow Conventional Commits; the scope for this directory is `examples`.
