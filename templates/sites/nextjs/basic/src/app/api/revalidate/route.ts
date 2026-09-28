// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * Route Handler that drops the article cache.
 *
 * The caller is not a reader's browser — usually a webhook from the console or from CI. This
 * route uses `revalidateTag()` on purpose, so an already-cached page is invalidated without
 * waiting out `HAMOLUS_REVALIDATE_SECONDS`.
 *
 * Two things have to hold for this endpoint not to become a hole:
 *
 *   1. **The token has to be compared**, not just present. `if (!token)` accepts an empty
 *      string.
 *   2. **A constant-time comparison.** `timingSafeEqual`, so the length of a wrong token
 *      does not leak through how long the comparison takes.
 *
 * `HAMOLUS_REVALIDATE_TOKEN` carries no `NEXT_PUBLIC_` prefix — with one, the token would be
 * inlined into the bundle and readable by anyone who opens view-source.
 */
import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'
import { articleTag, articlesTag } from '@/lib/articles'

/**
 * Optional body: `{ "id": "<record id>" }`.
 *
 * Without `id`, what gets dropped is the article list cache. With `id`, only the detail page
 * of that record is dropped — and because the article list stays cached, a single edited
 * article does not force the whole front page to be rebuilt.
 *
 * `id` goes into the tag, so it has to be bounded first: a free-form string can produce a
 * tag that never existed in the cache. The pattern below allows exactly the id characters
 * the core itself uses.
 */
export async function POST(request: Request) {
  const expected = process.env.HAMOLUS_REVALIDATE_TOKEN
  if (!expected) {
    return Response.json(
      { error: { code: 'NOT_CONFIGURED', message: 'HAMOLUS_REVALIDATE_TOKEN is not set' } },
      { status: 503 },
    )
  }

  const provided = request.headers.get('x-hamolus-token') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  const matches = a.length === b.length && timingSafeEqual(a, b)
  if (!matches) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Token does not match' } },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (id && !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return Response.json(
      { error: { code: 'INVALID_ID', message: 'id may only contain letters, numbers, _ and -' } },
      { status: 400 },
    )
  }

  const tag = id ? articleTag(id) : articlesTag
  revalidateTag(tag)
  return Response.json({ data: { revalidated: tag } })
}
