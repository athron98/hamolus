// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { listRecords, defaultLocale, tagFor } from './hamolus'

/**
 * Shape of an `articles` record in the core, and the cached access to it.
 *
 * Localized columns follow the core's rule: a `title` field with locales `id` and `en` is
 * stored as `title_id` and `title_en`, and the core returns the requested `locale` version
 * on the `title` field. The site side does not need to know anything about the naming.
 */
export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  /** Markdown; see the rendering note in `src/app/blog/[slug]/page.tsx`. */
  body: string
  cover: string
  tags: string[]
  author_name: string
  published_at: string
}

/**
 * Published articles, newest first.
 *
 * The filter and the ordering belong to the core, not to manual curation on the site side.
 * The query is `strict`, so `sortBy: 'published_at'` is rejected with `INVALID_QUERY` when
 * that field is missing from the collection definition.
 */
export async function listPublishedArticles(locale: string = defaultLocale) {
  return listRecords<Article>('articles', {
    page: 1,
    pageSize: 20,
    sortBy: 'published_at',
    sortDir: 'desc',
    locale,
    filter: { status: { op: 'eq', value: 'published' } },
    // The tag goes through the query, not a separate argument: without it `listRecords`
    // falls back to the default `hamolus:articles:default` tag, and
    // `revalidateTag(articlesTag)` would not reach anything that is cached.
    tag: articlesTag,
  })
}

/** Cache tag for the published article list, so it can be dropped without taking the rest. */
export const articlesTag = tagFor('articles', 'published')

/**
 * Cache tag for a single article.
 *
 * The detail page uses a tag per record, so a webhook that knows which id changed can drop
 * one page without dropping the whole list.
 */
export const articleTag = (id: string) => tagFor('articles', `detail:${id}`)
