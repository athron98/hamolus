import type {
  PanelAssetListResponse,
  PanelAssetObject,
  PanelBootstrap,
  PanelDefinition,
  PanelMetricResult,
} from '@hamolus/types'
import { PanelError, normalizePanelError } from './errors'
import type {
  PanelAssetExpiryOptions,
  PanelAssetListQuery,
  PanelAssetObject as PanelAsset,
  PanelAssetUploadOptions,
  PanelAssetUrlOptions,
  PanelCallOptions,
  PanelFetch,
  PanelOptions,
  PanelRecord,
  PanelRecordInput,
  PanelRecordListResponse,
  PanelRecordQuery,
  PanelRecordRequestOptions,
  PanelRelationOption,
} from './types'
import { normalizeApiBase } from './url'

type QueryValue = string | number | boolean | null | undefined
type QueryValues = Record<string, QueryValue>

export class PanelClient {
  readonly apiBase: string
  readonly land?: string
  readonly colony?: string

  private readonly token: string
  private readonly fetchImpl: PanelFetch

  constructor(options: PanelOptions) {
    this.apiBase = normalizeApiBase(options.apiBase)
    this.token = options.token.trim()
    if (!this.token) {
      throw new PanelError('A Panel API token is required', { code: 'MISSING_TOKEN' })
    }
    this.land = cleanHeader(options.land)
    this.colony = cleanHeader(options.colony)
    const fetcher = options.fetch ?? globalThis.fetch
    if (typeof fetcher !== 'function') {
      throw new PanelError('This runtime does not provide fetch', { code: 'FETCH_UNAVAILABLE' })
    }
    this.fetchImpl = (input, init) => fetcher(input, init)
  }

  listPanels(options?: PanelCallOptions): Promise<PanelDefinition[]> {
    return this.requestData('/_panels', { method: 'GET' }, undefined, options)
  }

  getPanel(panelId: string, options?: PanelCallOptions): Promise<PanelDefinition> {
    return this.requestData(panelPath(panelId), { method: 'GET' }, undefined, options)
  }

  createPanel(definition: PanelDefinition, options?: PanelCallOptions): Promise<PanelDefinition> {
    return this.requestData(
      '/_panels',
      jsonRequest('POST', { definition }),
      undefined,
      options,
    )
  }

  updatePanel(
    panelId: string,
    definition: PanelDefinition,
    options?: PanelCallOptions,
  ): Promise<PanelDefinition> {
    if (definition.id !== panelId) {
      throw new PanelError('Panel definition id must match the path id', { code: 'INVALID_ARGUMENT' })
    }
    return this.requestData(
      panelPath(panelId),
      jsonRequest('PUT', { definition }),
      undefined,
      options,
    )
  }

  deletePanel(panelId: string, options?: PanelCallOptions): Promise<void> {
    return this.request<void>(panelPath(panelId), { method: 'DELETE' }, undefined, options)
  }

  bootstrap(panelId: string, options?: PanelCallOptions): Promise<PanelBootstrap> {
    return this.requestData(
      `${panelPath(panelId)}/bootstrap`,
      { method: 'GET' },
      undefined,
      options,
    )
  }

  listRecords(
    panelId: string,
    viewId: string,
    query?: PanelRecordQuery,
    options?: PanelCallOptions,
  ): Promise<PanelRecordListResponse> {
    return this.requestEnvelope<PanelRecordListResponse>(
      recordsPath(panelId, viewId),
      { method: 'GET' },
      query,
      options,
    )
  }

  getRecord(
    panelId: string,
    viewId: string,
    recordId: string,
    options?: PanelRecordRequestOptions,
  ): Promise<PanelRecord> {
    return this.requestData(
      `${recordsPath(panelId, viewId)}/${segment(recordId)}`,
      { method: 'GET' },
      recordLocaleQuery(options),
      options,
    )
  }

  createRecord(
    panelId: string,
    viewId: string,
    input: PanelRecordInput,
    options?: PanelRecordRequestOptions,
  ): Promise<PanelRecord> {
    return this.requestData(
      recordsPath(panelId, viewId),
      jsonRequest('POST', input),
      recordLocaleQuery(options),
      options,
    )
  }

  updateRecord(
    panelId: string,
    viewId: string,
    recordId: string,
    input: PanelRecordInput,
    options?: PanelRecordRequestOptions,
  ): Promise<PanelRecord> {
    return this.requestData(
      `${recordsPath(panelId, viewId)}/${segment(recordId)}`,
      jsonRequest('PATCH', input),
      recordLocaleQuery(options),
      options,
    )
  }

  deleteRecord(
    panelId: string,
    viewId: string,
    recordId: string,
    options?: PanelCallOptions,
  ): Promise<void> {
    return this.request<void>(
      `${recordsPath(panelId, viewId)}/${segment(recordId)}`,
      { method: 'DELETE' },
      undefined,
      options,
    )
  }

  listRelationOptions(
    panelId: string,
    viewId: string,
    field: string,
    query?: PanelRecordQuery,
    options?: PanelCallOptions,
  ): Promise<PanelRelationOption[]> {
    return this.requestData(
      `${viewPath(panelId, viewId)}/relations/${segment(field)}/options`,
      { method: 'GET' },
      query,
      options,
    )
  }

  getDashboardMetrics(
    panelId: string,
    viewId: string,
    options?: PanelCallOptions,
  ): Promise<PanelMetricResult[]> {
    return this.requestData(
      `${viewPath(panelId, viewId)}/dashboard`,
      { method: 'GET' },
      undefined,
      options,
    )
  }

  listAssets(
    panelId: string,
    viewId: string,
    field: string,
    query?: PanelAssetListQuery,
    options?: PanelCallOptions,
  ): Promise<PanelAssetListResponse> {
    return this.requestEnvelope<PanelAssetListResponse>(
      assetsPath(panelId, viewId),
      { method: 'GET' },
      { ...query, field },
      options,
    )
  }

  uploadAsset(
    panelId: string,
    viewId: string,
    field: string,
    file: File,
    options: PanelAssetUploadOptions = {},
  ): Promise<PanelAssetObject> {
    const form = new FormData()
    form.append('file', file, file.name)
    if (options.name !== undefined) form.append('name', options.name)
    return this.requestData(
      assetsPath(panelId, viewId),
      { method: 'POST', body: form },
      { field },
      options,
    )
  }

  deleteAsset(
    panelId: string,
    viewId: string,
    field: string,
    assetId: string,
    options?: PanelCallOptions,
  ): Promise<void> {
    return this.request<void>(
      `${assetsPath(panelId, viewId)}/${segment(assetId)}`,
      { method: 'DELETE' },
      { field },
      options,
    )
  }

  private async requestData<T>(
    path: string,
    init: RequestInit,
    query?: QueryValues,
    options?: PanelCallOptions,
  ): Promise<T> {
    const envelope = await this.requestEnvelope<{ data: T }>(path, init, query, options)
    return envelope.data
  }

  private async requestEnvelope<T>(
    path: string,
    init: RequestInit,
    query?: QueryValues,
    options?: PanelCallOptions,
  ): Promise<T> {
    const payload = await this.request<unknown>(path, init, query, options)
    if (!isRecord(payload) || !Object.prototype.hasOwnProperty.call(payload, 'data')) {
      throw new PanelError('Panel API response is missing the data envelope', {
        status: 200,
        code: 'INVALID_RESPONSE',
        details: payload,
        url: this.url(path, query),
      })
    }
    return payload as T
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    query?: QueryValues,
    options?: PanelCallOptions,
  ): Promise<T> {
    const url = this.url(path, query)
    let response: Response
    let raw: string
    try {
      const headers = new Headers(init.headers)
      headers.set('authorization', `Bearer ${this.token}`)
      if (this.land) headers.set('x-land', this.land)
      if (this.colony) headers.set('x-colony', this.colony)
      response = await this.fetchImpl(url, {
        ...init,
        headers,
        signal: options?.signal ?? init.signal,
      })
      raw = await response.text()
    } catch (error) {
      throw normalizePanelError(error, 'Panel API request failed', url)
    }

    let payload: unknown
    let parseError: unknown
    if (raw.trim()) {
      try {
        payload = JSON.parse(raw)
      } catch (error) {
        parseError = error
      }
    }

    if (!response.ok) throw responseError(response, payload, raw, url)
    if (response.status === 204) return undefined as T
    if (!raw.trim()) {
      throw new PanelError('Panel API returned an empty response', {
        status: response.status,
        code: 'INVALID_RESPONSE',
        url,
      })
    }
    if (parseError) {
      throw new PanelError('Panel API returned invalid JSON', {
        status: response.status,
        code: 'INVALID_RESPONSE',
        url,
        cause: parseError,
        details: raw,
      })
    }
    return payload as T
  }

  private url(path: string, query?: QueryValues): string {
    return `${this.apiBase}${path}${encodeQuery(query)}`
  }
}

export function createPanelClient(options: PanelOptions): PanelClient {
  return new PanelClient(options)
}

export function getPanelAssetUrl(
  asset: Pick<PanelAsset, 'url' | 'downloadUrl'>,
  options: PanelAssetUrlOptions = {},
): string {
  return options.download ? asset.downloadUrl : asset.url
}

export function isPanelAssetExpired(
  asset: Pick<PanelAsset, 'expiresAt'>,
  options: PanelAssetExpiryOptions = {},
): boolean {
  const nowMs = options.nowMs ?? Date.now()
  const leewaySeconds = options.leewaySeconds ?? 0
  return asset.expiresAt * 1000 - leewaySeconds * 1000 <= nowMs
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function recordLocaleQuery(options?: PanelRecordRequestOptions): QueryValues | undefined {
  return options?.locale === undefined ? undefined : { locale: options.locale }
}

function panelPath(panelId: string): string {
  return `/_panels/${segment(panelId)}`
}

function viewPath(panelId: string, viewId: string): string {
  return `${panelPath(panelId)}/views/${segment(viewId)}`
}

function recordsPath(panelId: string, viewId: string): string {
  return `${viewPath(panelId, viewId)}/records`
}

function assetsPath(panelId: string, viewId: string): string {
  return `${viewPath(panelId, viewId)}/assets`
}

function segment(value: string): string {
  return encodeURIComponent(value)
}

function cleanHeader(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

function encodeQuery(query?: QueryValues): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params.append(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

function responseError(
  response: Response,
  payload: unknown,
  raw: string,
  url: string,
): PanelError {
  const root = isRecord(payload) ? payload : undefined
  const direct = root && isRecord(root.error) ? root.error : undefined
  const nestedData = root && isRecord(root.data) ? root.data : undefined
  const nested = nestedData && isRecord(nestedData.error) ? nestedData.error : undefined
  const error = direct ?? nested
  const message = stringValue(error?.message)
    ?? stringValue(root?.message)
    ?? stringValue(response.statusText)
    ?? `Panel API request failed with HTTP ${response.status}`
  return new PanelError(message, {
    status: response.status,
    code: stringValue(error?.code) ?? `HTTP_${response.status}`,
    details: error ?? payload ?? raw,
    url,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}
