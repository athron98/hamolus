import type { FileKind } from './api'

/** Copy + labels shared by the file-library pages, pickers and editors. */
export const FILE_KIND_META: Record<
  FileKind,
  { title: string; noun: string; plural: string; sub: string; scope: string }
> = {
  document: {
    title: 'Documents',
    noun: 'document',
    plural: 'documents',
    sub: 'Documents stored in Cloudflare R2 (public viewer + download)',
    scope: 'document',
  },
  attachment: {
    title: 'Attachments',
    noun: 'attachment',
    plural: 'attachments',
    sub: 'Any file type stored in Cloudflare R2 (raw bytes served directly)',
    scope: 'attachment',
  },
}

export function fileKindMeta(kind: FileKind) {
  return FILE_KIND_META[kind]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Human description of a file ref value, e.g. `report.pdf · application/pdf · 12 KB`. */
export function fileRefLabel(value: unknown): {
  name: string
  mime: string
  size: string
  url: string
  id: string
} {
  const o = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  return {
    name: o && typeof o.name === 'string' ? o.name : o && typeof o.id === 'string' ? o.id : 'file',
    mime: o && typeof o.mime === 'string' ? o.mime : '',
    size: o && typeof o.size === 'number' ? formatBytes(o.size) : '',
    url: o && typeof o.url === 'string' ? o.url : '',
    id: o && typeof o.id === 'string' ? o.id : '',
  }
}

/** File extension badge text (uppercase, trimmed to ~5 chars). */
export function extBadge(ext: string | null | undefined): string {
  const e = (ext ?? 'file').toUpperCase()
  return e.slice(0, 5) || 'FILE'
}