import type {
  AuthChangePasswordInput,
  AuthLoginInput,
  AuthSetupInput,
  AuthUser,
  AuthUserCreateInput,
  AuthUserUpdateInput,
  CollectionDefinition,
  ConfigEntry,
  ConfigEntryInput,
  ConfigScope,
  ColonyDto,
  ColonyDefinitionInput,
  DashboardStats,
  ErrorResponse,
  FileObject,
  FilePatch,
  FilterMap,
  GroupDefinition,
  ItemResponse,
  LandDto,
  LandDefinitionInput,
  ListQuery,
  ListResponse,
  LoginResponse,
  MediaObject,
  MediaTaxonomy,
  MediaTaxonomyDetail,
  MediaUpdate,
  MediaUploadMeta,
  Permission,
  PanelDefinition,
  SortDir,
  SuperAdminCreateInput,
  SuperAdminUpdateInput,
  SuperAdminUser,
  TaxonomyAction,
} from '@hamolus/types'
import { apiBase, colony, land, storeToken, token } from './store'

/** One aspect-ratio variant to upload alongside the default asset (paired with a `variantMeta` part). */
export interface MediaVariantUpload {
  file: File
  label: string
  focusX: number
  focusY: number
}

/** Which file library a request targets (document / attachment). */
export type FileKind = 'document' | 'attachment'

/** Optional metadata carried on a file upload (name + SEO + taxonomy). */
export interface FileUploadMeta {
  name?: string
  title?: string
  description?: string
  group?: string
  category?: string
  tags?: string[]
}

export type RecordRow = Record<string, unknown>
export type { AuthUser, Permission }

/** One raw physical row (rowid preserved for exact restore). */
export interface SeedRow {
  _rowid: number
  [key: string]: unknown
}

/** A group definition as stored in a snapshot. */
export interface SeedGroup {
  id: string
  label: string
  parent?: string | null
  icon?: string | null
}

/** An R2 asset embedded as base64 in the snapshot. */
export interface SeedObjectBytes {
  b64: string
  mime: string
}

/** The JSON snapshot produced by `GET /_meta/seed/export`. */
export interface SeedSnapshot {
  kind: 'hamolus-seed'
  version: 1
  exportedAt: string
  origin: string
  land: string
  scope: string
  settings: Record<string, unknown> | null
  groups: SeedGroup[]
  collections: CollectionDefinition[]
  records: Record<string, SeedRow[]>
  media: Array<Record<string, unknown>> | null
  mediaObjects: Record<string, SeedObjectBytes> | null
}

/** Summary returned by `POST /_meta/seed/apply`. */
export interface SeedApplySummary {
  sourceLand: string
  sourceOrigin: string
  collections: string[]
  groups: number
  settings: boolean
  media: number
  mediaObjects: number
  records: number
}

export interface AuthSessionData {
  user: AuthUser
  permissions: Permission[]
}

export interface AuthMeResponse {
  data: AuthSessionData
}

export interface ConfigListResponse {
  data: ConfigEntry[]
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function getToken(): string | null {
  return token()
}

/** Scope headers for the active endpoint: `x-colony` always, `x-land` for land-admin tooling. */
function scopeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const c = colony()
  if (c) headers['x-colony'] = c
  const l = land()
  if (l) headers['x-land'] = l
  return headers
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    usp.set(key, String(value))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...scopeHeaders(),
      ...init?.headers,
    },
  })

  const body = (await res.json().catch(() => null)) as T | ErrorResponse | null

  if (!res.ok) {
    if (res.status === 401) {
      storeToken(null)
    }
    const err = body as ErrorResponse | null
    throw new ApiError(
      res.status,
      err?.error?.code ?? 'UNKNOWN',
      err?.error?.message ?? `HTTP ${res.status}`,
    )
  }
  return body as T
}

async function upload<T>(path: string, form: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const token = getToken()
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...scopeHeaders(),
    },
    body: form,
  })
  const body = (await res.json().catch(() => null)) as T | ErrorResponse | null
  if (!res.ok) {
    if (res.status === 401) storeToken(null)
    const err = body as ErrorResponse | null
    throw new ApiError(res.status, err?.error?.code ?? 'UNKNOWN', err?.error?.message ?? `HTTP ${res.status}`)
  }
  return body as T
}

export const api = {
  token(key: string): Promise<ItemResponse<{ token: string; expiresAt: string }>> {
    return request('/_auth/token', { method: 'POST', body: JSON.stringify({ key }) })
  },

  listCollections(): Promise<{ data: CollectionDefinition[] }> {
    return request('/_meta/collections')
  },

  getStats(): Promise<{ data: DashboardStats }> {
    return request('/_meta/stats')
  },

  getSettings(): Promise<{ data: Record<string, unknown> }> {
    return request('/_meta/settings')
  },

  putSettings(patch: Record<string, unknown>): Promise<{ data: Record<string, unknown> }> {
    return request('/_meta/settings', { method: 'PUT', body: JSON.stringify(patch) })
  },

  putCollection(name: string, def: CollectionDefinition): Promise<ItemResponse<CollectionDefinition>> {
    return request(`/_meta/collections/${name}`, { method: 'PUT', body: JSON.stringify(def) })
  },

  deleteCollection(name: string): Promise<null> {
    return request(`/_meta/collections/${name}`, { method: 'DELETE' })
  },

  listPanels(): Promise<{ data: PanelDefinition[] }> {
    return request('/_panels')
  },

  getPanel(id: string): Promise<ItemResponse<PanelDefinition>> {
    return request(`/_panels/${encodeURIComponent(id)}`)
  },

  createPanel(definition: PanelDefinition): Promise<ItemResponse<PanelDefinition>> {
    return request('/_panels', { method: 'POST', body: JSON.stringify({ definition }) })
  },

  updatePanel(id: string, definition: PanelDefinition): Promise<ItemResponse<PanelDefinition>> {
    return request(`/_panels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ definition }),
    })
  },

  deletePanel(id: string): Promise<null> {
    return request(`/_panels/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listGroups(): Promise<{ data: GroupDefinition[] }> {
    return request('/_meta/groups')
  },

  putGroup(id: string, def: GroupDefinition): Promise<ItemResponse<GroupDefinition>> {
    return request(`/_meta/groups/${id}`, { method: 'PUT', body: JSON.stringify(def) })
  },

  deleteGroup(id: string): Promise<null> {
    return request(`/_meta/groups/${id}`, { method: 'DELETE' })
  },

  getLastUpdate(name: string): Promise<{ data: { lastUpdate: string | null } }> {
    return request(`/${name}/__lastUpdate`)
  },

  listRecords(
    name: string,
    query: Pick<ListQuery, 'page' | 'pageSize' | 'sortBy' | 'sortDir'> & { filter?: FilterMap; locale?: string; search?: string },
  ): Promise<ListResponse<RecordRow> & { lastUpdate?: string | null }> {
    const qs = toQuery({
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDir: query.sortDir as SortDir | undefined,
      filter: query.filter ? JSON.stringify(query.filter) : undefined,
      locale: query.locale,
      search: query.search,
    })
    return request(`/${name}${qs}`)
  },

  getRecord(name: string, id: string, locale?: string): Promise<ItemResponse<RecordRow>> {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : ''
    return request(`/${name}/${encodeURIComponent(id)}${qs}`)
  },

  createRecord(name: string, values: Record<string, unknown>): Promise<ItemResponse<RecordRow>> {
    return request(`/${name}`, { method: 'POST', body: JSON.stringify(values) })
  },

  updateRecord(name: string, id: string, values: Record<string, unknown>): Promise<ItemResponse<RecordRow>> {
    return request(`/${name}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(values) })
  },

  deleteRecord(name: string, id: string): Promise<null> {
    return request(`/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  bulkDeleteRecords(name: string, ids: string[]): Promise<{ data: { deleted: number } }> {
    return request(`/${name}/__bulk_delete`, { method: 'POST', body: JSON.stringify({ ids }) })
  },

  listMedia(query: {
    page?: number
    pageSize?: number
    search?: string
    group?: string
    category?: string
    tag?: string
  }): Promise<ListResponse<MediaObject>> {
    const qs = toQuery({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      group: query.group,
      category: query.category,
      tag: query.tag,
    })
    return request(`/_media${qs}`)
  },

  getMediaTaxonomy(): Promise<ItemResponse<MediaTaxonomy>> {
    return request('/_media/taxonomy')
  },

  getMediaTaxonomyDetail(): Promise<ItemResponse<MediaTaxonomyDetail>> {
    return request('/_media/taxonomy/detail')
  },

  applyTaxonomyChange(action: TaxonomyAction): Promise<ItemResponse<MediaTaxonomyDetail>> {
    return request('/_media/taxonomy', { method: 'POST', body: JSON.stringify(action) })
  },

  getMedia(id: string): Promise<ItemResponse<MediaObject>> {
    return request(`/_media/${encodeURIComponent(id)}`)
  },

  uploadMedia(
    file: File,
    meta?: MediaUploadMeta,
    thumb?: File,
    variants?: MediaVariantUpload[],
  ): Promise<ItemResponse<MediaObject>> {
    const form = new FormData()
    form.append('file', file, file.name)
    if (thumb) form.append('thumb', thumb, thumb.name)
    if (meta) {
      if (meta.name) form.append('name', meta.name)
      if (meta.title) form.append('title', meta.title)
      if (meta.alt) form.append('alt', meta.alt)
      if (meta.description) form.append('description', meta.description)
      if (meta.caption) form.append('caption', meta.caption)
      if (meta.group) form.append('group', meta.group)
      if (meta.category) form.append('category', meta.category)
      if (meta.tags && meta.tags.length > 0) form.append('tags', JSON.stringify(meta.tags))
      if (meta.focusX !== undefined && meta.focusX !== null) form.append('focusX', String(meta.focusX))
      if (meta.focusY !== undefined && meta.focusY !== null) form.append('focusY', String(meta.focusY))
    }
    if (variants && variants.length > 0) {
      for (const v of variants) form.append('variant', v.file, v.file.name)
      form.append(
        'variantMeta',
        JSON.stringify(variants.map((v) => ({ label: v.label, focusX: v.focusX, focusY: v.focusY }))),
      )
    }
    return upload('/_media', form)
  },

  updateMedia(id: string, patch: MediaUpdate): Promise<ItemResponse<MediaObject>> {
    return request(`/_media/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  },

  replaceMedia(id: string, file: File, thumb?: File): Promise<ItemResponse<MediaObject>> {
    const form = new FormData()
    form.append('file', file, file.name)
    if (thumb) form.append('thumb', thumb, thumb.name)
    return upload(`/_media/${encodeURIComponent(id)}`, form, 'PUT')
  },

  deleteMedia(id: string): Promise<null> {
    return request(`/_media/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // ---- files (documents + attachments) ----

  listFiles(
    kind: FileKind,
    query: {
      page?: number
      pageSize?: number
      search?: string
      group?: string
      category?: string
      tag?: string
    },
  ): Promise<ListResponse<FileObject>> {
    const qs = toQuery({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      group: query.group,
      category: query.category,
      tag: query.tag,
    })
    return request(`/_${kind}s${qs}`)
  },

  getFileTaxonomy(kind: FileKind): Promise<ItemResponse<MediaTaxonomy>> {
    return request(`/_${kind}s/taxonomy`)
  },

  getFile(kind: FileKind, id: string): Promise<ItemResponse<FileObject>> {
    return request(`/_${kind}s/${encodeURIComponent(id)}`)
  },

  uploadFile(kind: FileKind, file: File, meta?: FileUploadMeta): Promise<ItemResponse<FileObject>> {
    const form = new FormData()
    form.append('file', file, file.name)
    if (meta) {
      if (meta.name) form.append('name', meta.name)
      if (meta.title) form.append('title', meta.title)
      if (meta.description) form.append('description', meta.description)
      if (meta.group) form.append('group', meta.group)
      if (meta.category) form.append('category', meta.category)
      if (meta.tags && meta.tags.length > 0) form.append('tags', JSON.stringify(meta.tags))
    }
    return upload(`/_${kind}s`, form)
  },

  updateFile(kind: FileKind, id: string, patch: FilePatch): Promise<ItemResponse<FileObject>> {
    return request(`/_${kind}s/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
  },

  deleteFile(kind: FileKind, id: string): Promise<null> {
    return request(`/_${kind}s/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // ---- auth ----

  setupStatus(): Promise<{ data: { setupRequired: boolean } }> {
    return request('/_auth/setup')
  },

  setup(input: AuthSetupInput): Promise<LoginResponse> {
    return request('/_auth/setup', { method: 'POST', body: JSON.stringify(input) })
  },

  login(input: AuthLoginInput): Promise<LoginResponse> {
    return request('/_auth/login', { method: 'POST', body: JSON.stringify(input) })
  },

  me(): Promise<AuthMeResponse> {
    return request('/_auth/me')
  },

  changeMyPassword(input: AuthChangePasswordInput): Promise<ItemResponse<AuthUser>> {
    return request('/_auth/me/password', { method: 'POST', body: JSON.stringify(input) })
  },

  listUsers(): Promise<ListResponse<AuthUser>> {
    return request('/_auth/users')
  },

  createUser(input: AuthUserCreateInput): Promise<ItemResponse<AuthUser>> {
    return request('/_auth/users', { method: 'POST', body: JSON.stringify(input) })
  },

  updateUser(id: string, patch: AuthUserUpdateInput): Promise<ItemResponse<AuthUser>> {
    return request(`/_auth/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
  },

  deleteUser(id: string): Promise<null> {
    return request(`/_auth/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // ---- config ----

  listConfigs(scope?: ConfigScope): Promise<ConfigListResponse> {
    return request(`/_config${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)
  },

  putConfig(key: string, input: ConfigEntryInput): Promise<ItemResponse<ConfigEntry>> {
    return request(`/_config/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(input) })
  },

  deleteConfig(key: string): Promise<null> {
    return request(`/_config/${encodeURIComponent(key)}`, { method: 'DELETE' })
  },

  // ---- universe (platform land/colony registry — `lands.*` / `colonies.*` permissions) ----

  listLands(): Promise<{ data: LandDto[] }> {
    return request('/_meta/universe/lands')
  },

  putLand(id: string, input: LandDefinitionInput): Promise<ItemResponse<LandDto>> {
    return request(`/_meta/universe/lands/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  },

  deleteLand(id: string): Promise<null> {
    return request(`/_meta/universe/lands/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listColonies(land?: string): Promise<{ data: ColonyDto[] }> {
    return request(`/_meta/universe/colonies${land ? `?land=${encodeURIComponent(land)}` : ''}`)
  },

  putColony(
    id: string,
    input: ColonyDefinitionInput & { landId: string },
  ): Promise<ItemResponse<ColonyDto>> {
    return request(`/_meta/universe/colonies/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  },

  deleteColony(id: string, land?: string): Promise<null> {
    return request(`/_meta/universe/colonies/${encodeURIComponent(id)}${land ? `?land=${encodeURIComponent(land)}` : ''}`, {
      method: 'DELETE',
    })
  },

  // ---- super admins (global platform accounts — `lands.*` permissions) ----

  superStatus(): Promise<{ data: { setupRequired: boolean } }> {
    return request('/_auth/super')
  },

  listSupers(): Promise<{ data: SuperAdminUser[] }> {
    return request('/_auth/supers')
  },

  createSuper(input: SuperAdminCreateInput): Promise<ItemResponse<SuperAdminUser>> {
    return request('/_auth/supers', { method: 'POST', body: JSON.stringify(input) })
  },

  updateSuper(id: string, patch: SuperAdminUpdateInput): Promise<ItemResponse<SuperAdminUser>> {
    return request(`/_auth/supers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
  },

  deleteSuper(id: string): Promise<null> {
    return request(`/_auth/supers/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  // ---- seed (inverse generator — export/apply full state snapshots) ----

  exportSeed(scope: string, withMediaBytes: boolean): Promise<SeedSnapshot> {
    const qs = toQuery({ scope, media: withMediaBytes ? 'bytes' : 'none' })
    return request(`/_meta/seed/export${qs}`)
  },

  applySeed(snap: SeedSnapshot, wipe: boolean): Promise<{ data: SeedApplySummary }> {
    const qs = wipe ? '?wipe=true' : '?wipe=false'
    return request(`/_meta/seed/apply${qs}`, { method: 'POST', body: JSON.stringify(snap) })
  },
}