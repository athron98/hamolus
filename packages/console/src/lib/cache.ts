import type { PaginationMeta } from '@hamolus/types'
import type { RecordRow } from './api'

const CACHE_PREFIX = 'console-cache:'
const HASH_PREFIX = 'console-hash:'

function cacheKey(
  name: string,
  page: number,
  pageSize: number,
  locale: string,
  search: string,
  sortBy: string,
  sortDir: string,
): string {
  return `${CACHE_PREFIX}${name}:${page}:${pageSize}:${locale}:${search}:${sortBy}:${sortDir}`
}

function hashKey(name: string): string {
  return `${HASH_PREFIX}${name}`
}

export function getHash(name: string): string | null {
  try {
    return localStorage.getItem(hashKey(name))
  } catch {
    return null
  }
}

export function setHash(name: string, hash: string | null): void {
  try {
    if (hash) localStorage.setItem(hashKey(name), hash)
    else localStorage.removeItem(hashKey(name))
  } catch {
    /* storage full — ignore */
  }
}

export function getCachedRecords(
  name: string,
  page: number,
  pageSize: number,
  locale: string,
  search: string,
  sortBy = '',
  sortDir = '',
): { data: RecordRow[]; meta: PaginationMeta } | null {
  try {
    const raw = localStorage.getItem(cacheKey(name, page, pageSize, locale, search, sortBy, sortDir))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setCachedRecords(
  name: string,
  page: number,
  pageSize: number,
  locale: string,
  search: string,
  data: RecordRow[],
  meta: PaginationMeta,
  sortBy = '',
  sortDir = '',
): void {
  try {
    localStorage.setItem(
      cacheKey(name, page, pageSize, locale, search, sortBy, sortDir),
      JSON.stringify({ data, meta }),
    )
  } catch {
    /* storage full — ignore */
  }
}

/** Drop every record plus hash cache entry (used when switching endpoints). */
export function clearRecordCaches(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith(CACHE_PREFIX) || k.startsWith(HASH_PREFIX))) doomed.push(k)
    }
    for (const k of doomed) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}
