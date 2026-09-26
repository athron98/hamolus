export function normalizeApiBase(apiBase: string): string {
  const value = apiBase.trim()
  if (!value) return '/api'
  const normalized = value.replace(/\/+$/, '')
  if (!normalized) return '/api'
  if (normalized.includes('?') || normalized.includes('#')) {
    throw new TypeError('Panel API base must not contain a query string or fragment')
  }
  if (normalized.startsWith('/')) return normalized

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new TypeError('Panel API base must be an absolute URL or an absolute path')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('Panel API base must use HTTP or HTTPS')
  }
  if (url.search || url.hash) {
    throw new TypeError('Panel API base must not contain a query string or fragment')
  }
  if (!url.pathname || url.pathname === '/') url.pathname = '/api'
  return url.toString().replace(/\/+$/, '')
}
