import { useQuery } from '@tanstack/solid-query'
import type { Accessor } from 'solid-js'
import type { CollectionDefinition, FieldDefinition } from '@hamolus/types'
import { api, type RecordRow } from './api'
import { locale } from './locale'

const LABEL_PRIORITY = ['label', 'title', 'name']

export interface RelationOption {
  value: string
  label: string
}

export interface RelationContext {
  def: CollectionDefinition | undefined
  pk: string
  labelField: string | null
  rows: RecordRow[]
  options: RelationOption[]
}

function labelFieldOf(def: CollectionDefinition | undefined, pk: string): string | null {
  if (!def) return null
  for (const n of LABEL_PRIORITY) {
    if (def.fields.some((f) => f.name === n && f.type === 'string' && f.name !== pk)) return n
  }
  const alt = def.fields.find((f) => f.type === 'string' && f.name !== pk)
  return alt ? alt.name : null
}

export function buildRelationLabel(
  row: RecordRow,
  pk: string,
  labelField: string | null,
): string {
  if (labelField && String(row[labelField] ?? '') !== '') return String(row[labelField])
  return String(row[pk] ?? '')
}

async function loadContext(target: string, loc?: string): Promise<RelationContext> {
  const defs = await api.listCollections()
  const def = defs.data.find((c) => c.name === target)
  const pk = def?.primaryKey ?? 'id'
  const labelField = labelFieldOf(def, pk)
  let rows: RecordRow[] = []
  if (def) {
    const res = await api.listRecords(target, { page: 1, pageSize: 100, sortDir: 'asc', sortBy: pk, locale: loc })
    rows = res.data
  }
  const options = rows.map((row) => ({
    value: String(row[pk] ?? ''),
    label: buildRelationLabel(row, pk, labelField),
  }))
  return { def, pk, labelField, rows, options }
}

/** Options for a single relation target — used by the record form dropdown. */
export function useRelationContext(target: Accessor<string | undefined>) {
  return useQuery(() => ({
    enabled: !!target(),
    queryKey: ['relations', 'context', target() ?? '', locale()] as const,
    queryFn: () => loadContext(target()!, locale()),
  }))
}

/**
 * id → label maps for every relation field of a collection — used by the table
 * so a relation column shows the target record's human label instead of an id.
 */
export function useRelationLabelMaps(collection: Accessor<CollectionDefinition | undefined>) {
  const relationFields = () =>
    (collection()?.fields ?? []).filter((f): f is FieldDefinition => f.type === 'relation')
  return useQuery(() => ({
    enabled: relationFields().length > 0,
    queryKey: ['relations', 'maps', collection()?.name ?? '', locale()] as const,
    queryFn: async () => {
      const defs = await api.listCollections()
      const maps: Record<string, Map<string, string>> = {}
      for (const field of relationFields()) {
        const target = field.relation?.collection
        if (!target) continue
        const tdef = defs.data.find((c) => c.name === target)
        const pk = tdef?.primaryKey ?? 'id'
        const labelField = labelFieldOf(tdef, pk)
        const m = new Map<string, string>()
        if (tdef) {
          const res = await api.listRecords(target, { page: 1, pageSize: 100, sortDir: 'asc', sortBy: pk, locale: locale() })
          for (const row of res.data) m.set(String(row[pk] ?? ''), buildRelationLabel(row, pk, labelField))
        }
        maps[field.name] = m
      }
      return maps
    },
  }))
}