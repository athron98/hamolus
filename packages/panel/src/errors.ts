export interface ApiErrorOptions {
  status?: number
  code?: string
  details?: unknown
  url?: string
  cause?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  readonly url?: string

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code ?? 'API_ERROR'
    this.details = options.details
    this.url = options.url
  }
}

export class PanelError extends ApiError {
  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options)
    this.name = 'PanelError'
  }
}

export function normalizePanelError(
  error: unknown,
  fallbackMessage = 'Panel request failed',
  url?: string,
): PanelError {
  if (error instanceof PanelError) return error
  if (error instanceof ApiError) {
    return new PanelError(error.message, {
      status: error.status,
      code: error.code,
      details: error.details,
      url: error.url ?? url,
      cause: error.cause ?? error,
    })
  }
  if (error instanceof Error) {
    return new PanelError(error.message || fallbackMessage, {
      status: 0,
      code: error.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR',
      url,
      cause: error,
    })
  }
  return new PanelError(fallbackMessage, {
    status: 0,
    code: 'NETWORK_ERROR',
    details: error,
    url,
  })
}
