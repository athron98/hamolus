import { apiBase } from './store'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

/** Origin of the active core endpoint, for absolute endpoints, else the page origin (dev proxy). */
function endpointOrigin(): string {
  const base = apiBase()
  try {
    if (!base.startsWith('/')) return new URL(base).origin
  } catch {
    /* fall through */
  }
  return typeof window === 'undefined' ? '' : window.location.origin
}

const FILE_PATH_RE = /^\/(media|documents|attachments)\//

/**
 * Records store media/file URLs as absolute snapshots (e.g. `{url}` in a media
 * field, rich-text image `src`). Those are baked at write time and may point
 * at a loopback host (localhost seeding). For display, rewrite any media or
 * file-library path that is hosted on a loopback address into the active
 * endpoint's origin so assets render wherever that endpoint actually lives.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http:///')) return url
  try {
    const u = new URL(url)
    if (!FILE_PATH_RE.test(u.pathname)) return url
    if (!LOOPBACK_HOSTS.has(u.hostname)) return url
    const origin = endpointOrigin()
    return origin + u.pathname + u.search
  } catch {
    return url
  }
}