// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { listRecords } from './hamolus'
import type { FilterMap, ListResponse } from './hamolus'

/**
 * Shape of a `products` record in the core.
 *
 * `price` is stored as a number, not a string holding "Rp 149.000". The core stores the
 * number; the site formats what is displayed. Because its type is `number`, `null` can be
 * there for a product that has no price yet, and that `null` means "price to follow", not
 * free.
 */
export interface Product {
  id: string
  name: string
  slug: string
  description: string
  image: string
  price: number | null
  /** Stock value; used to mark "out of stock" without reading the whole catalog. */
  stock: number
  category: string
  tags: string[]
  status: 'draft' | 'active' | 'archived'
}

export interface CatalogQuery {
  page?: number
  /**
   * Page size. Defaults to `PAGE_SIZE`.
   *
   * This has to match the value used when the page is rendered. Counting pages with a
   * different `pageSize` — `1`, say, so the response stays small — makes `meta.totalPages`
   * come out of a different division, and the result is a link to a page with nothing in it:
   * "page 2 of 1".
   */
  pageSize?: number
  category?: string
  search?: string
  inStockOnly?: boolean
  maxPrice?: number
  locale?: string
}

/** The core accepts a `pageSize` of at most 100. */
export const PAGE_SIZE = 24

/**
 * A hard cap on the number of pages per category for a static build.
 *
 * Unlike `PAGE_SIZE`, which sets how much goes on one page, this sets how many HTML files a
 * single category is allowed to produce. Astro's `getStaticPaths` may only use *imported*
 * values: a `const` in the page frontmatter is not carried over into the `getStaticPaths`
 * module, so this cap has to live in a plain module.
 */
export const MAX_PAGES = 20

/**
 * The filtered catalog.
 *
 * Filters go out as a `FilterMap` — `{ field: { op, value } }` — and `listRecords` turns
 * that into a JSON string. Two things to keep apart so the result is not wrong:
 *
 *   - Text search does **not** go through a filter. `search` is sent as a core parameter in
 *     its own right, because the core already has a per-collection search implementation. A
 *     hand-written `contains` filter can duplicate results instead, or rank them differently
 *     from the core's own search.
 *   - The price bound uses `lte` and concerns the price of **one** product, not a cart total
 *     — the core does not do carts.
 *   - More than one category can be written `{ category: { op: 'in', value: [...] } }`, but
 *     the static route in `pages/c/[category]/[page].astro` does not use it: a single URL
 *     segment may only hold one category name.
 */
export function listProducts(query: CatalogQuery = {}): Promise<ListResponse<Product>> {
  const filter: FilterMap = { status: { op: 'eq', value: 'active' } }

  if (query.category) {
    filter.category = { op: 'eq', value: query.category }
  }
  if (query.inStockOnly) {
    filter.stock = { op: 'gt', value: 0 }
  }
  if (query.maxPrice !== undefined && Number.isFinite(query.maxPrice)) {
    filter.price = { op: 'lte', value: query.maxPrice }
  }

  return listRecords<Product>('products', {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? PAGE_SIZE,
    sortBy: 'name',
    sortDir: 'asc',
    locale: query.locale,
    search: query.search,
    filter,
  })
}

/** Shape of a `categories` record; `slug` is what the URL segment uses. */
export interface Category {
  name: string
  slug?: string
}

/** The category list for the filter control. */
export function listCategories(): Promise<ListResponse<Category>> {
  return listRecords<Category>('categories', {
    page: 1,
    pageSize: 100,
    sortBy: 'name',
    sortDir: 'asc',
  })
}

/**
 * A category name becomes a URL segment.
 *
 * The core's `slug` field is used when present, because a human-written slug does not change
 * when the category is renamed. Without one, the name is simplified here so the path stays
 * ASCII and free of spaces.
 */
export function categorySlug(category: Category): string {
  const explicit = typeof category.slug === 'string' ? category.slug.trim() : ''
  return explicit || slugify(category.name)
}

/** Lowercase, no punctuation, spaces become hyphens. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Format a price.
 *
 * `null` means there is no price yet, and that is different from a price of zero — the
 * first shows as "Price to follow", the second as "Free". `Intl.NumberFormat` is used
 * because decimal marks and thousands separators differ between locales.
 */
export function formatPrice(price: number | null, locale: string): string {
  if (price === null) return 'Price to follow'
  if (price === 0) return 'Free'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR' }).format(price)
}
