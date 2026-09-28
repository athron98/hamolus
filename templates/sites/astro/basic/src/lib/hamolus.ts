// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
/**
 * REST client for the Hamolus core.
 *
 * Why hand-written instead of using `@hamolus/panel`: that package is pinned to the panel
 * endpoints (`/api/_panels/...`) and **requires** a token, while what this site needs is
 * `GET /api/{collection}`, which can be called without authentication as long as
 * `PUBLIC_GETS` is still `true` on the core (the default). Pulling the admin SDK into a
 * public site only adds attack surface without adding capability.
 *
 * What this file holds to:
 *
 *   1. **No `Authorization` header.** The header is deliberately never sent. The auth
 *      middleware in the core demands a valid JWT as soon as it appears, so sending it
 *      without a token only breaks a request that used to succeed.
 *   2. **The base URL is normalised once.** `/api` is appended when missing, so both
 *      `{{CORE_ORIGIN}}` and `{{CORE_ORIGIN}}/api` are correct.
 *   3. **The query is encoded.** `filter` goes out as a JSON string; `URLSearchParams`
 *      does the encoding, so there is no hand-assembled query string.
 *   4. **Errors are thrown as `HamolusApiError`**, carrying `status` and `code` so a page
 *      can tell a 404 (no such slug) from a 500 (the core is currently broken).
 *
 * The shapes of `data`, `meta`, and `lastUpdate` follow `packages/types/src/dto.ts` in this
 * repo. The types below are declared locally on purpose: the site does not pull
 * `@hamolus/types` into the browser bundle, because that package brings zod and is used
 * server-side.
 */

/** The pagination envelope, mirroring `PaginationMeta` in `@hamolus/types`. */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** List shape, mirroring `ListResponse<T>` in `@hamolus/types`. */
export interface ListResponse<T> {
  data: T[]
  meta: PaginationMeta
  /** Hash of the last change; used to decide revalidation, not for display. */
  lastUpdate: number
}

/** Single record shape, mirroring `ItemResponse<T>` in `@hamolus/types`. */
export interface ItemResponse<T> {
  data: T
}

/** One filter clause. Available operators: eq, neq, gt, gte, lt, lte, like, in, contains. */
export interface FilterClause {
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'contains'
  value: unknown
}

/** Filter map per field: `{ title: { op: 'contains', value: 'astro' } }`. */
export type FilterMap = Record<string, FilterClause>

export interface ListQuery {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  filter?: FilterMap
  locale?: string
  search?: string
}

/** An error that carries information from the core, not just an HTTP status. */
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

const origin = (import.meta.env.PUBLIC_HAMOLUS_ORIGIN as string | undefined)?.replace(
  /\/+$/,
  '',
)

const apiBase = origin
  ? origin.endsWith('/api')
    ? origin
    : `${origin}/api`
  : '{{CORE_ORIGIN}}/api'

/** Default locale; the full language list belongs to the core, not to the site. */
export const defaultLocale = (import.meta.env.PUBLIC_HAMOLUS_LOCALE as string | undefined) ?? 'id'

/**
 * The only place that does I/O.
 *
 * The timeout is not optional: a build that waits forever is harder to diagnose than a
 * build that fails with a clear message.
 */
async function request<T>(path: string, query: ListQuery = {}): Promise<T> {
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
    // No Authorization header — see note (1) above.
    headers: { accept: 'application/json' },
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

/** List the records of one collection. */
export function listRecords<T = Record<string, unknown>>(
  collection: string,
  query: ListQuery = {},
): Promise<ListResponse<T>> {
  return request<ListResponse<T>>(`/${collection}`, { locale: defaultLocale, ...query })
}

/**
 * One record by id.
 *
 * Note: the core route is `/api/{collection}/{id}` — **id**, not a slug. Walk
 * `getStaticPaths` to build whatever routes read nicely in a URL, then keep fetching the
 * detail by id. If a runtime lookup by slug is ever needed, fetch the list and search it
 * yourself; the core has no "find by field" endpoint.
 */
export function getRecord<T = Record<string, unknown>>(
  collection: string,
  id: string,
  query: Pick<ListQuery, 'locale'> = {},
): Promise<ItemResponse<T>> {
  return request<ItemResponse<T>>(`/${collection}/${encodeURIComponent(id)}`, {
    locale: defaultLocale,
    ...query,
  })
}

/**
 * Hash of the last change to a collection.
 *
 * The endpoint is cheap because of `pageSize: 0`: only the hash comes back. It exists to
 * decide whether a page has to be rebuilt, not to display anything.
 */
export async function getLastUpdate(collection: string): Promise<{ lastUpdate: number }> {
  const body = await request<{ data: { lastUpdate: number } }>(`/${collection}/__lastUpdate`, {
    pageSize: 0,
  })
  return { lastUpdate: body.data.lastUpdate }
}
