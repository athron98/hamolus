// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * REST client for the Hamolus core, Next.js server only.
 *
 * Unlike the version in the Astro example, this file uses Next's `fetch`, which already
 * has a cache of its own. Two cache options are in play:
 *
 *   - `next: { revalidate: N }` — the core response is reused for N seconds, then fetched
 *     again in the background. That is what keeps the blog fast while the core is slow.
 *   - `next: { tags: [...] }` — labels the response so `revalidateTag()` can drop it when
 *     the content changes.
 *
 * With neither set, `fetch` in a Server Component is dynamic and the page is re-rendered
 * on every request. For a list of articles that changes once in a while, that is waste
 * that buys nothing.
 *
 * The same note as in the Astro example applies: **there is no `Authorization` header**.
 * The auth middleware in the core demands a valid JWT the moment that header appears, so
 * sending it without a token only breaks a request that used to succeed.
 */


export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListResponse<T> {
  data: T[]
  meta: PaginationMeta
  lastUpdate: number
}

export interface ItemResponse<T> {
  data: T
}

export interface FilterClause {
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'contains'
  value: unknown
}

export type FilterMap = Record<string, FilterClause>

export interface ListQuery {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  filter?: FilterMap
  locale?: string
  search?: string
  /**
   * Cache tag for this request, replacing the per-collection default.
   *
   * Used to separate two views of one collection: the list of published articles is tagged
   * `hamolus:articles:published`, while the drafts list uses `hamolus:articles:default`.
   * Without that split, a `revalidateTag()` for one view never reaches the other.
   */
  tag?: string
}

export class HamolusApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HamolusApiError'
    this.status = status
    this.code = code
  }
}

/**
 * True when the core does not have the collection the page asked for.
 *
 * A brand-new project is in exactly this state, so treating it as a failure makes the first
 * thing a new user sees an error — "Collection 'articles' is not registered" — instead of the
 * "no content yet" page. The empty state is the honest rendering of a core that has nothing
 * in it, and it is the one the wizard's seed exists to move you out of.
 *
 * The distinction is by error code, not by status: `404` alone would also cover a missing
 * record, and a missing record on a list call is the same situation from here.
 */
export function isMissingCollection(cause: unknown): boolean {
  return cause instanceof HamolusApiError && cause.code === 'NOT_FOUND'
}

const origin = (process.env.HAMOLUS_API_ORIGIN ?? '{{CORE_ORIGIN}}').replace(/\/+$/, '')

const apiBase = origin.endsWith('/api') ? origin : `${origin}/api`

/**
 * Next cache for a single core response.
 *
 * `revalidate` is read from the environment so it can be changed without a rebuild — and it
 * gets a sensible default: if the env var is forgotten, the page still has a cache, it is
 * just staler.
 */
const revalidate = Number(process.env.HAMOLUS_REVALIDATE_SECONDS ?? 60)

export const defaultLocale = process.env.HAMOLUS_LOCALE ?? 'id'

/** Cache tag per collection, so one collection can be revalidated without the others. */
export const tagFor = (collection: string, view = 'default') => `hamolus:${collection}:${view}`

async function request<T>(
  path: string,
  query: ListQuery = {},
  tag?: string,
): Promise<T> {
  const search = new URLSearchParams()
  if (query.page !== undefined) search.set('page', String(query.page))
  if (query.pageSize !== undefined) search.set('pageSize', String(query.pageSize))
  if (query.sortBy !== undefined) search.set('sortBy', query.sortBy)
  if (query.sortDir !== undefined) search.set('sortDir', query.sortDir)
  if (query.locale !== undefined) search.set('locale', query.locale)
  if (query.search !== undefined) search.set('search', query.search)
  if (query.filter !== undefined) search.set('filter', JSON.stringify(query.filter))

  const suffix = search.size > 0 ? `?${search.toString()}` : ''
  const url = `${apiBase}${path}${suffix}`

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    next: tag ? { revalidate, tags: [tag] } : { revalidate },
    signal: AbortSignal.timeout(15_000),
  })

  const text = await response.text()
  const body = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error
    throw new HamolusApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `HTTP ${response.status}`,
    )
  }

  return body as T
}

export function listRecords<T = Record<string, unknown>>(
  collection: string,
  query: ListQuery = {},
): Promise<ListResponse<T>> {
  // The default per-collection tag; `query.tag` replaces it for a specific view. Without
  // this option every query on one collection shares a tag, and a `revalidateTag()` for a
  // single view never hits anything.
  const { tag, ...rest } = query
  return request<ListResponse<T>>(
    `/${collection}`,
    { locale: defaultLocale, ...rest },
    tag ?? tagFor(collection),
  )
}

/** Core routes use the **id**, not the slug. The slug is for URLs, and mapped separately. */
export function getRecord<T = Record<string, unknown>>(
  collection: string,
  id: string,
  query: Pick<ListQuery, 'locale'> = {},
): Promise<ItemResponse<T>> {
  return request<ItemResponse<T>>(
    `/${collection}/${encodeURIComponent(id)}`,
    { locale: defaultLocale, ...query },
    tagFor(collection, `detail:${id}`),
  )
}

/*
 * Note: there is no React `cache()` wrapper in this file, and that is a deliberate choice.
 *
 * `generateMetadata` and the page component both call the article list, so it looks like
 * two requests to the core are needed. Two things already cover that without extra code:
 *
 *   1. `fetch` with `next: { revalidate, tags }` goes into the Next Data Cache, and
 *      identical GET requests within one render are skipped outright.
 *   2. If several different fetches ever do need to be folded into one job, `cache()` is
 *      still the right tool.
 *
 * What is being avoided here is an application-level cache: once there are two layers of
 * invalidation, the answer to "why is this page still stale" becomes a lot harder than one
 * `revalidate` rule and one list of tags.
 */
