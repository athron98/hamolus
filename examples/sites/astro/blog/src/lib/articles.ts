// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { listRecords } from './hamolus'

/**
 * Shape of an `articles` record in the core.
 *
 * The fields here are declared locally rather than imported, because `@hamolus/types`
 * brings zod and would not make it into the browser bundle anyway. What matters is which
 * columns change: as soon as the core gains a field, add it here too and TypeScript will
 * point at every place still using the old shape.
 *
 * Localized columns follow the core's rule: a `title` field with locales `id` and `en` is
 * stored as `title_id` and `title_en`. The core returns the requested `locale` version on
 * the `title` field, so the site side does not need to know anything about the naming.
 */
export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  /** Markdown. How it gets rendered is noted in `src/pages/[slug].astro`. */
  body: string
  cover: string
  tags: string[]
  author_name: string
  /** ISO date, e.g. `2026-04-01`. */
  published_at: string
  status: 'draft' | 'published'
}

/** Articles that are ready to go out, newest first. */
export function listPublishedArticles(locale?: string) {
  return listRecords<Article>('articles', {
    page: 1,
    pageSize: 50,
    sortBy: 'published_at',
    sortDir: 'desc',
    locale,
    filter: { status: { op: 'eq', value: 'published' } },
  })
}
