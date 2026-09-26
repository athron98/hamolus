export type ActivityType =
  | 'collection.create'
  | 'collection.update'
  | 'collection.delete'
  | 'record.create'
  | 'record.update'
  | 'record.delete'
  | 'media.upload'
  | 'media.update'
  | 'media.delete'
  | 'document.upload'
  | 'document.update'
  | 'document.delete'
  | 'attachment.upload'
  | 'attachment.update'
  | 'attachment.delete'
  | 'settings.update'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'config.create'
  | 'config.update'
  | 'config.delete'
  | 'group.create'
  | 'group.update'
  | 'group.delete'
  | 'land.create'
  | 'land.update'
  | 'land.delete'
  | 'colony.create'
  | 'colony.update'
  | 'colony.delete'
  | 'super.create'
  | 'super.update'
  | 'super.delete'
  | 'seed.export'
  | 'seed.apply'
  | 'panel.create'
  | 'panel.update'
  | 'panel.delete'

export interface ActivityEntry {
  id: string
  type: ActivityType
  /** Short human-readable summary, e.g. "Updated record in posts". */
  label: string
  /** Optional extra context (collection name, record id, asset name…). */
  detail?: string
  /** ISO timestamp. */
  at: string
}

const KEY = 'console-activity'
const MAX = 50

function read(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : []
  } catch {
    return []
  }
}

function write(entries: ActivityEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Most recent activity, newest first. */
export function getActivity(): ActivityEntry[] {
  return read()
}

/** Append an activity entry (capped at MAX, newest first). */
export function logActivity(type: ActivityType, label: string, detail?: string): void {
  const entry: ActivityEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    label,
    detail,
    at: new Date().toISOString(),
  }
  write([entry, ...read()].slice(0, MAX))
  window.dispatchEvent(new Event('console-activity'))
}

/** Remove every stored activity entry. */
export function clearActivity(): void {
  write([])
  window.dispatchEvent(new Event('console-activity'))
}

/** Subscribe to activity changes (same-tab custom event). */
export function onActivityChange(handler: () => void): () => void {
  const listener = () => handler()
  window.addEventListener('console-activity', listener)
  return () => window.removeEventListener('console-activity', listener)
}
