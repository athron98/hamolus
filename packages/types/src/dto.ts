import { z } from 'zod'
import type { AuthUser, Permission } from './auth'

export const SORT_DIRS = ['asc', 'desc'] as const
export type SortDir = (typeof SORT_DIRS)[number]

export const FILTER_OPS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'in',
  'contains',
] as const
export type FilterOp = (typeof FILTER_OPS)[number]

export interface FilterClause {
  op: FilterOp
  value: unknown
}

/** Peta filter per field: { "title": { "op": "contains", "value": "x" } } */
export type FilterMap = Record<string, FilterClause>

export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortDir: z.enum(SORT_DIRS).default('desc'),
    /** JSON string of a FilterMap */
    filter: z
      .string()
      .optional()
      .transform((s) => {
        if (!s) return undefined
        try {
          return JSON.parse(s) as unknown
        } catch {
          return undefined
        }
      }),
  })
  .strict()

export type ListQuery = z.infer<typeof listQuerySchema>

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ItemResponse<T> {
  data: T
}

/** Body for `POST /:collection/__bulk_delete` (multi-select record removal). */
export const bulkDeleteSchema = z
  .object({
    ids: z
      .array(z.string().min(1, 'Record id cannot be empty'))
      .min(1, 'Select at least one record')
      .max(200, 'Select at most 200 records at once'),
  })
  .strict()

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>

/** Response of `POST /:collection/__bulk_delete`. */
export interface BulkDeleteResult {
  /** Number of rows actually deleted / soft-deleted. */
  deleted: number
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function errorResponse(code: string, message: string, details?: unknown): ErrorResponse {
  return { error: { code, message, details } }
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export interface LoginRequest {
  key: string
}

/**
 * Successful /api/_auth/token, /api/_auth/login and /api/_auth/setup responses.
 * `user` + `permissions` are present for EVERY new token (username/password);
 * legacy ADMIN_KEY `/token` responses only include `token`/`expiresAt` for
 * backward compatibility with existing console tokens.
 */
export interface LoginResponse {
  data: {
    token: string
    expiresAt: string
    user?: AuthUser
    permissions?: Permission[]
  }
}

/**
 * Value stored by a `media` collection field: a self-contained reference to a
 * media asset. The URL is an absolute path so consumers (console, site, API)
 * can render it without a second lookup; the URL derives from a UUID R2 key,
 * so it stays stable across renames.
 */
export const mediaFieldValueSchema = z.object({
  /** `MediaObject.id`. */
  id: z.string().min(1, 'Media reference requires an id'),
  /** Public absolute URL (`MediaObject.url`), served from `/media/<key>`. */
  url: z.string().min(1, 'Media reference requires a url'),
  /** Alt text captured at pick time (mirrors `MediaObject.alt`). */
  alt: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  /** Focus point X in the stored image, percent (0–100) — optional, default center. */
  focusX: z.number().min(0).max(100).nullable().optional(),
  /** Focus point Y in the stored image, percent (0–100) — optional, default center. */
  focusY: z.number().min(0).max(100).nullable().optional(),
})

export type MediaFieldValue = z.infer<typeof mediaFieldValueSchema>

/** An aspect-ratio crop variant of a media asset (its own R2 object, same record). */
export interface MediaVariant {
  /** Machine label (e.g. `2x1`, `1-1`); sanitized into the R2 object key suffix. */
  label: string
  /** R2 object key (e.g. `<id>.2x1.webp`). */
  key: string
  /** Public absolute URL served from the core (`/media/<key>`). */
  url: string
  width: number | null
  height: number | null
  /** Focus point within the variant frame, percent (0–100). */
  focusX: number
  focusY: number
}

/** A media asset stored in the R2 `MEDIA` bucket (metadata mirrors a D1 row). */
export interface MediaObject {
  id: string
  /** R2 object key (unique, e.g. `<uuid>.<ext>`). */
  key: string
  /** Display filename (renameable via PATCH). */
  name: string
  mime: string
  size: number
  /** Pixel dimensions extracted on upload (null for non-raster or unknown). */
  width: number | null
  height: number | null
  /** SEO title for the asset. */
  title: string | null
  /** SEO alt text for the asset. */
  alt: string | null
  /** SEO description / caption. */
  description: string | null
  /** Organization group (freeform label, e.g. "Heroes", "Products"). */
  group: string | null
  /** Category label (freeform). */
  category: string | null
  /** Tags (freeform labels; stored as a JSON array). */
  tags: string[]
  /** Focus point X, percent (0–100) — null = center. */
  focusX: number | null
  /** Focus point Y, percent (0–100) — null = center. */
  focusY: number | null
  /** Public absolute URL served from the core (`/media/<key>`). */
  url: string
  /** R2 key of the auto-generated thumbnail (small WebP for lazy loading); null if none. */
  thumbKey: string | null
  /** Public absolute URL of the thumbnail (`/media/<thumbKey>`); null if none. */
  thumbUrl: string | null
  /** Short caption/attribution surfaced in the SEO viewer. */
  caption: string | null
  /** Aspect-ratio crop variants (each its own R2 object, keyed `<id>.<label>.<ext>`). */
  variants: MediaVariant[]
  createdAt: string
  updatedAt: string
}

export const mediaUpdateSchema = z
  .object({
    /** Rename the asset (display name; R2 key stays a UUID). */
    name: z.string().trim().min(1, 'Name cannot be empty').max(255).optional(),
    title: z.string().trim().max(255).nullable().optional(),
    alt: z.string().trim().max(1024).nullable().optional(),
    description: z.string().trim().max(4096).nullable().optional(),
    caption: z.string().trim().max(4096).nullable().optional(),
    group: z.string().trim().max(60).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    tags: z.array(z.string().trim().min(1, 'Tags cannot be empty').max(60)).max(30).nullable().optional(),
    /** Focus point percent (0–100); null clears back to center. */
    focusX: z.number().min(0).max(100).nullable().optional(),
    focusY: z.number().min(0).max(100).nullable().optional(),
  })
  .strict()

/** Body for PATCH /api/_media/{id} (only the given keys are updated). */
export type MediaUpdate = z.infer<typeof mediaUpdateSchema>

/** One crop variant upload: label + focus within the variant frame. */
export const mediaVariantMetaSchema = z
  .object({
    label: z.string().trim().min(1, 'Variant label cannot be empty').max(40),
    focusX: z.number().min(0).max(100),
    focusY: z.number().min(0).max(100),
  })
  .strict()

export type MediaVariantMeta = z.infer<typeof mediaVariantMetaSchema>

/** Metadata sent per crop variant (paired index-wise with the `variant` file parts). */
export const mediaVariantsMetaSchema = z.array(mediaVariantMetaSchema).max(24)

/** Optional metadata sent with a multipart upload (form fields, all optional). */
export const mediaUploadMetaSchema = z
  .object({
    name: z.string().trim().max(255).optional(),
    title: z.string().trim().max(255).nullable().optional(),
    alt: z.string().trim().max(1024).nullable().optional(),
    description: z.string().trim().max(4096).nullable().optional(),
    caption: z.string().trim().max(4096).nullable().optional(),
    group: z.string().trim().max(60).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    tags: z.array(z.string().trim().min(1, 'Tags cannot be empty').max(60)).max(30).nullable().optional(),
    focusX: z.coerce.number().min(0).max(100).nullable().optional(),
    focusY: z.coerce.number().min(0).max(100).nullable().optional(),
  })
  .strict()

/** Metadata accepted with `POST /api/_media` (form fields). */
export type MediaUploadMeta = z.infer<typeof mediaUploadMetaSchema>

/** Distinct media taxonomy values, for filters and suggestions. */
export interface MediaTaxonomy {
  groups: string[]
  categories: string[]
  tags: string[]
}

export const TAXONOMY_TYPES = ['group', 'category', 'tag'] as const
export type TaxonomyType = (typeof TAXONOMY_TYPES)[number]

/** One taxonomy value with its usage count across assets. */
export interface TaxonomyValue {
  value: string
  count: number
}

/** Per-type taxonomy with usage counts, for the console management panel. */
export interface MediaTaxonomyDetail {
  groups: TaxonomyValue[]
  categories: TaxonomyValue[]
  tags: TaxonomyValue[]
}

/** Rename or remove a taxonomy value across every asset (`to` omitted = remove). */
export const taxonomyActionSchema = z
  .object({
    type: z.enum(TAXONOMY_TYPES),
    /** Current value (exact match). */
    from: z.string().trim().min(1).max(60),
    /** Replacement value; omitting it removes the value wherever it is applied. */
    to: z.string().trim().min(1).max(60).optional(),
  })
  .strict()

export type TaxonomyAction = z.infer<typeof taxonomyActionSchema>

/** One collection's rolled-up stats for the console dashboard. */
export interface CollectionStat {
  name: string
  label: string
  icon?: string
  group?: string
  count: number
}

/** Aggregated dashboard statistics returned by `GET /api/_meta/stats`. */
export interface DashboardStats {
  /** Number of registered collections. */
  collections: number
  /** Total records across every collection (soft-deleted rows excluded). */
  totalRecords: number
  /** Number of media assets. */
  media: number
  /** Distinct non-empty groups across collections. */
  groups: number
  perCollection: CollectionStat[]
}

export const MEDIA_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
  'image/x-icon',
] as const
export type MediaMime = (typeof MEDIA_MIMES)[number]

/**
 * File-library kinds shipped by the core: `document` (allow-listed document
 * MIME types, public HTML viewer + download) and `attachment` (any file type,
 * raw bytes served directly).
 */
export const FILE_KINDS = ['document', 'attachment'] as const
export type FileKind = (typeof FILE_KINDS)[number]

/** MIME types accepted by the `document` file library (attachments accept anything). */
export const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/epub+zip',
  'application/zip',
] as const
export type DocumentMime = (typeof DOCUMENT_MIMES)[number]

/**
 * A file stored in the `document` / `attachment` library (metadata mirrors a
 * D1 row; bytes live in the R2 `MEDIA` bucket under a `doc/` / `att/` prefix).
 */
export interface FileObject {
  id: string
  /** R2 object key incl. the library prefix (e.g. `doc/<uuid>.pdf`). */
  key: string
  /** Display filename (renameable via PATCH; the R2 key stays stable). */
  name: string
  mime: string
  size: number
  /** Lowercased file extension (without the dot). */
  ext: string
  /** SEO title for the asset. */
  title: string | null
  /** SEO description. */
  description: string | null
  /** Organization group (freeform label). */
  group: string | null
  /** Category label (freeform). */
  category: string | null
  /** Tags (freeform labels; stored as a JSON array). */
  tags: string[]
  /** Public absolute URL served from the core (`/documents/<basename>` / `/attachments/<basename>`). */
  url: string
  /** Download URL (documents only, `/documents/<basename>/download`); null for attachments. */
  downloadUrl: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Metadata + taxonomy patch for a file asset. Used both as the PATCH body and
 * as the upload form metadata (all keys optional; `""` clears to null).
 */
export const filePatchSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(255).optional(),
    title: z.string().trim().max(255).nullable().optional(),
    description: z.string().trim().max(4096).nullable().optional(),
    group: z.string().trim().max(60).nullable().optional(),
    category: z.string().trim().max(60).nullable().optional(),
    tags: z.array(z.string().trim().min(1, 'Tags cannot be empty').max(60)).max(30).nullable().optional(),
  })
  .strict()

/** Body for PATCH /api/_documents/{id} / /api/_attachments/{id} (only given keys are updated). */
export type FilePatch = z.infer<typeof filePatchSchema>

/**
 * Value stored by a `document` / `attachment` collection field: a
 * self-contained reference to a file asset. Like `media` fields, the URL is an
 * absolute string derived from the UUID R2 key, so it stays stable across renames.
 */
export const fileRefValueSchema = z.object({
  /** `FileObject.id`. */
  id: z.string().min(1, 'File reference requires an id'),
  /** Public absolute URL (`FileObject.url`), served from `/documents/<key>` / `/attachments/<key>`. */
  url: z.string().min(1, 'File reference requires a url'),
  /** Display filename captured at pick time (mirrors `FileObject.name`). */
  name: z.string().nullable().optional(),
  /** MIME type captured at pick time. */
  mime: z.string().nullable().optional(),
  /** Byte size captured at pick time. */
  size: z.number().int().nonnegative().nullable().optional(),
  /** Lowercased file extension (without the dot). */
  ext: z.string().nullable().optional(),
})

export type FileRefValue = z.infer<typeof fileRefValueSchema>