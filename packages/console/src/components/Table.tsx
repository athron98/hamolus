/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { CollectionDefinition, FieldDefinition, SortDir } from '@hamolus/types'
import {
  DEFAULT_CURRENCY,
  formatCurrencyDisplay,
  formatCustomCurrencyDisplay,
  markdownToPlainText,
} from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import type { RecordRow } from '../hooks/records'
import { useRelationLabelMaps } from '../lib/relations'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ColumnsIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
} from './Icons'
import { getPlainTextFromLexical } from './LexicalEditor'
import { fieldLabel } from '../lib/labels'
import { resolveMediaUrl } from '../lib/media'
import { formatBytes } from '../lib/files'

const COLS_KEY = 'console-cols'
const WIDTHS_KEY = 'console-colw'
const GROUPBY_KEY = 'console-groupby'
const MIN_COL_WIDTH = 48

function loadVisible(name: string): string[] | null {
  try {
    const raw = localStorage.getItem(COLS_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, string[]>
    return Array.isArray(map[name]) ? map[name] : null
  } catch {
    return null
  }
}

function saveVisible(name: string, fields: string[]): void {
  try {
    const raw = localStorage.getItem(COLS_KEY)
    const map: Record<string, string[]> = raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
    map[name] = fields
    localStorage.setItem(COLS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function loadWidths(name: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(WIDTHS_KEY)
    if (!raw) return {}
    const map = JSON.parse(raw) as Record<string, Record<string, number>>
    return map[name] ?? {}
  } catch {
    return {}
  }
}

function saveWidths(name: string, widths: Record<string, number>): void {
  try {
    const raw = localStorage.getItem(WIDTHS_KEY)
    const map: Record<string, Record<string, number>> = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {}
    map[name] = widths
    localStorage.setItem(WIDTHS_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function loadGroupBy(name: string): string | null {
  try {
    const raw = localStorage.getItem(GROUPBY_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, string | null>
    return typeof map[name] === 'string' && map[name] ? map[name] : null
  } catch {
    return null
  }
}

function saveGroupBy(name: string, field: string | null): void {
  try {
    const raw = localStorage.getItem(GROUPBY_KEY)
    const map: Record<string, string | null> = raw ? (JSON.parse(raw) as Record<string, string | null>) : {}
    map[name] = field
    localStorage.setItem(GROUPBY_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

const styles = stylex.create({
  wrap: {
    overflow: 'visible',
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowSm}`,
    borderRadius: tokens.radius,
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':hover': { boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadow}` },
  },
  toolbar: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
  },
  toolbarMeta: {
    fontSize: 11,
    color: tokens.textDim,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  columnsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    fontSize: 12,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, background: tokens.surfaceRaised },
  },
  selBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  selText: {
    fontSize: 11,
    color: tokens.textDim,
    whiteSpace: 'nowrap',
  },
  selBtn: {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.accent,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 1,
    borderRadius: tokens.radiusSm,
    padding: '3px 8px',
    cursor: 'pointer',
    boxShadow: `0 0 0 1px ${tokens.borderStrong}`,
    transition: 'color 0.15s ease, background-color 0.15s ease, opacity 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':disabled': { opacity: 0.4, cursor: 'default' },
  },
  selBtnDanger: {
    color: tokens.danger,
    ':hover': { color: tokens.danger, backgroundColor: tokens.dangerSoft },
  },
  checkCol: {
    width: 36,
    paddingRight: 4,
    paddingLeft: 4,
    textAlign: 'center',
  },
  checkCell: {
    width: 36,
    padding: '8px 4px',
    textAlign: 'center',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
  },
  rowCheck: {
    width: 14,
    height: 14,
    accentColor: tokens.accent,
    cursor: 'pointer',
    margin: 0,
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 10,
    zIndex: 20,
    minWidth: 220,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadow}`,
    borderRadius: tokens.radius,
    padding: 8,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 6px 8px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    marginBottom: 6,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
  },
  resetBtn: {
    fontSize: 11,
    color: tokens.accent,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    cursor: 'pointer',
    padding: 0,
    ':hover': { textDecoration: 'underline' },
  },
  colItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 6px',
    fontSize: 13,
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    color: tokens.text,
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  colCheck: {
    accentColor: tokens.accent,
    width: 14,
    height: 14,
    margin: 0,
    cursor: 'pointer',
  },
  tableScroll: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    tableLayout: 'fixed',
    '@media (max-width: 900px)': {
      minWidth: 680,
    },
  },
  th: {
    position: 'relative',
    textAlign: 'left',
    padding: '8px 10px',
    color: tokens.textDim,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    whiteSpace: 'nowrap',
  },
  thSortable: {
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'color 0.15s ease',
    ':hover': { color: tokens.accent },
  },
  thActive: {
    color: tokens.accent,
  },
  thLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sortIcon: {
    flexShrink: 0,
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 6,
    height: '100%',
    cursor: 'col-resize',
    touchAction: 'none',
    zIndex: 5,
  },
  resizeHandleActive: {
    backgroundColor: tokens.accent,
  },
  actionsCol: {
    width: 76,
  },
  td: {
    padding: '8px 10px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  trSelected: {
    backgroundColor: tokens.surfaceRaised,
  },
  empty: {
    padding: 28,
    textAlign: 'center',
    color: tokens.textDim,
  },
  actions: {
    display: 'flex',
    gap: 4,
    justifyContent: 'flex-end',
  },
  chip: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
  },
  chipAccent: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  chipOk: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
  chipNeutral: {
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
  },
  mono: {
    fontFamily: tokens.fontMono,
    fontSize: 12,
  },
  mediaCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  fileCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: 240,
  },
  mediaImg: {
    width: 26,
    height: 26,
    objectFit: 'cover',
    borderRadius: tokens.radiusSm,
    flexShrink: 0,
    backgroundColor: tokens.bg,
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    backgroundColor: tokens.surfaceRaised,
  },
  filterInput: {
    flex: 1,
    maxWidth: 280,
    padding: '6px 12px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.35s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  filterClear: {
    fontSize: 11,
    color: tokens.accent,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    ':hover': { textDecoration: 'underline' },
  },
  groupByRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  groupByLabel: {
    fontSize: 11,
    color: tokens.textDim,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  },
  groupSelect: {
    width: 'auto',
    minWidth: 96,
    padding: '5px 26px 5px 10px',
    fontSize: 12,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2398a1b4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    cursor: 'pointer',
    transition: `box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  thGroup: {
    textAlign: 'left',
    padding: '6px 10px',
    color: tokens.accent,
    fontWeight: 700,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '.07em',
    whiteSpace: 'nowrap',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    backgroundColor: tokens.surfaceRaised,
  },
  groupRow: {
    cursor: 'pointer',
    backgroundColor: tokens.surface,
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  groupCell: {
    padding: '5px 10px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
  },
  groupValue: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.text,
    fontSize: 12,
  },
  groupCount: {
    marginLeft: 8,
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
  },
  groupChevron: {
    display: 'inline-flex',
    marginLeft: 6,
    color: tokens.textDim,
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  groupChevronClosed: {
    transform: 'rotate(-90deg)',
  },
  groupValueRow: {
    display: 'flex',
    alignItems: 'center',
  },
})

function localizedText(field: FieldDefinition, value: unknown): string {
  const v = value ?? ''
  if (field.type === 'richtext') {
    if (field.format === 'markdown' || field.format === 'mdx') return markdownToPlainText(String(v))
    return getPlainTextFromLexical(v as Parameters<typeof getPlainTextFromLexical>[0])
  }
  return typeof v === 'string' ? v : JSON.stringify(v)
}

function CellValue(props: {
  field: FieldDefinition
  value: unknown
  relationLabels?: Map<string, string>
  locale?: string
}) {
  const { field, value } = props
  if (value === null || value === undefined || value === '') {
    return <span {...stylex.props(styles.chip, styles.chipNeutral)}>—</span>
  }
  if (field.localized && value && typeof value === 'object') {
    const obj = value as Record<string, string>
    const active = props.locale ?? Object.keys(obj)[0] ?? 'en'
    const text = localizedText(field, obj[active])
    const allLangs = Object.keys(obj)
      .map((l) => `${l}: ${localizedText(field, obj[l])}`)
      .join(' | ')
    return <span title={allLangs}>{text.slice(0, 80)}</span>
  }
  switch (field.type) {
    case 'boolean':
      return (
        <span {...stylex.props(styles.chip, value ? styles.chipOk : styles.chipNeutral)}>
          {value ? 'Yes' : 'No'}
        </span>
      )
    case 'enum': {
      if (Array.isArray(value)) {
        const vals = value as string[]
        return (
          <span title={vals.join(', ')}>
            {vals.map((v) => (
              <span {...stylex.props(styles.chip, styles.chipAccent)} style={{ 'margin-right': '4px' }}>{v}</span>
            ))}
          </span>
        )
      }
      return <span {...stylex.props(styles.chip, styles.chipAccent)}>{String(value)}</span>
    }
    case 'relation': {
      const key = String(value)
      const isMany = field.relation?.kind === 'hasMany' && Array.isArray(value)
      if (isMany) {
        const ids = value as string[]
        const labels = ids.map((id) => props.relationLabels?.get(id) ?? id)
        const target = field.relation?.collection ? ` → ${field.relation.collection}` : ''
        return (
          <span title={`${ids.join(', ')}${target}`}>
            {labels.map((l) => (
              <span {...stylex.props(styles.chip, styles.chipAccent)} style={{ 'margin-right': '4px' }}>{l}</span>
            ))}
          </span>
        )
      }
      const label = props.relationLabels?.get(key) || key
      const target = field.relation?.collection ? ` → ${field.relation.collection}` : ''
      return (
        <span {...stylex.props(styles.chip, styles.chipAccent)} title={`${key}${target}`}>
          {label}
        </span>
      )
    }
    case 'datetime':
      return <span {...stylex.props(styles.mono)}>{String(value).slice(0, 19).replace('T', ' ')}</span>
    case 'date':
      return <span {...stylex.props(styles.mono)}>{String(value)}</span>
    case 'number':
      return <span {...stylex.props(styles.mono)}>{String(value)}</span>
    case 'currency':
    case 'custom_currency': {
      const obj = value && typeof value === 'object' ? (value as { base?: number; display?: string }) : null
      const display = obj?.display || (typeof value === 'number'
        ? field.type === 'custom_currency'
          ? formatCustomCurrencyDisplay(value, field.customCurrency, props.locale)
          : formatCurrencyDisplay(value, { code: field.currency ?? DEFAULT_CURRENCY, locale: props.locale })
        : '')
      return <span {...stylex.props(styles.mono)} title={obj ? `base ${obj.base}` : undefined}>{display}</span>
    }
    case 'json':
      return (
        <span title={String(value)}>
          {(typeof value === 'string' ? value : JSON.stringify(value)).slice(0, 80)}
        </span>
      )
    case 'richtext': {
      const raw = field.localized && value && typeof value === 'object'
        ? ((value as Record<string, string>)[props.locale ?? 'en'] ?? '')
        : value
      const text =
        field.format === 'markdown' || field.format === 'mdx'
          ? markdownToPlainText(String(raw))
          : getPlainTextFromLexical(raw as string)
      return <span title={text}>{text.slice(0, 80)}</span>
    }
    case 'media': {
      const obj = typeof value === 'object' ? (value as Record<string, unknown>) : null
      const url = resolveMediaUrl(obj && typeof obj.url === 'string' ? obj.url : '')
      const alt = obj && typeof obj.alt === 'string' ? obj.alt : ''
      const meta = `${typeof obj?.width === 'number' && typeof obj?.height === 'number' ? `${obj.width}×${obj.height} · ` : ''}${url}`
      if (!url) return <span title={meta}>{'media'}</span>
      const focusStyle: Record<string, string> =
        typeof obj?.focusX === 'number' && typeof obj?.focusY === 'number'
          ? { 'object-position': `${obj.focusX}% ${obj.focusY}%` }
          : { 'object-position': 'center center' }
      return (
        <span {...stylex.props(styles.mediaCell)} title={meta}>
          <img src={url} alt="" style={focusStyle} {...stylex.props(styles.mediaImg)} />
          <span>{alt || 'media'}</span>
        </span>
      )
    }
    case 'document':
    case 'attachment': {
      const obj = typeof value === 'object' ? (value as Record<string, unknown>) : null
      const name = obj && typeof obj.name === 'string' ? obj.name : ''
      const size = obj && typeof obj.size === 'number' ? formatBytes(obj.size) : ''
      const ext = obj && typeof obj.ext === 'string' ? obj.ext.toUpperCase() : ''
      const url = resolveMediaUrl(obj && typeof obj.url === 'string' ? obj.url : '')
      const meta = [name, size, ext, url].filter(Boolean).join(' · ')
      return (
        <span {...stylex.props(styles.fileCell)} title={meta}>
          <FileTextIcon size={13} />
          <span>{name || ext || 'file'}</span>
        </span>
      )
    }
    default: {
      const text = String(value)
      return <span title={text}>{text}</span>
    }
  }
}

export function Table(props: {
  collection: CollectionDefinition
  rows: RecordRow[]
  selectedId?: string | null
  onSelect: (row: RecordRow) => void
  onDelete: (row: RecordRow) => void
  locale?: string
  search?: string
  onSearchChange?: (search: string) => void
  sortBy?: string
  sortDir?: SortDir
  onSort?: (field: string) => void
  onBulkDelete?: (ids: string[]) => Promise<boolean> | boolean
}) {
  const available = () => props.collection.fields.filter((f) => !f.hidden)
  const [visible, setVisible] = createSignal<string[]>(
    loadVisible(props.collection.name) ?? available().map((f) => f.name),
  )
  const [widths, setWidths] = createSignal<Record<string, number>>(loadWidths(props.collection.name))
  const [resizing, setResizing] = createSignal<string | null>(null)
  const [open, setOpen] = createSignal(false)
  const [groupBy, setGroupBy] = createSignal<string | null>(loadGroupBy(props.collection.name))
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set<string>())
  const [checked, setChecked] = createSignal<Set<string>>(new Set<string>())
  const checkedEnabled = () => typeof props.onBulkDelete === 'function'
  const rel = useRelationLabelMaps(() => props.collection)

  createEffect(
    on(() => props.collection.name, () => {
      setVisible(loadVisible(props.collection.name) ?? available().map((f) => f.name))
      setWidths(loadWidths(props.collection.name))
      setGroupBy(loadGroupBy(props.collection.name))
      setCollapsed(new Set<string>())
      setChecked(new Set<string>())
      setOpen(false)
    }),
  )

  const EMPTY_GROUP = '\u0000empty'
  const groupable = () =>
    available().filter(
      (f) =>
        f.type !== 'json' &&
        f.type !== 'richtext' &&
        f.type !== 'media' &&
        f.type !== 'document' &&
        f.type !== 'attachment' &&
        !(f.type === 'relation' && f.relation?.kind === 'hasMany') &&
        !(f.type === 'enum' && f.control === 'multichecklist'),
    )
  const groupField = () => groupable().find((f) => f.name === groupBy()) ?? null

  const groupKey = (field: FieldDefinition, row: RecordRow): string => {
    let v = row[field.name]
    if (field.localized && v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      v = obj[props.locale ?? 'en'] ?? obj[Object.keys(obj)[0] ?? ''] ?? ''
    }
    if (v === null || v === undefined || v === '') return EMPTY_GROUP
    return String(v)
  }

  const groupValueText = (
    field: FieldDefinition,
    value: unknown,
    maps: Record<string, Map<string, string>> | undefined,
  ): string => {
    let v = value
    if (field.localized && v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      v = obj[props.locale ?? 'en'] ?? obj[Object.keys(obj)[0] ?? ''] ?? ''
    }
    if (v === null || v === undefined || v === '') return '(empty)'
    switch (field.type) {
      case 'boolean':
        return v ? 'Yes' : 'No'
      case 'relation': {
        const raw = typeof v === 'object' && v !== null ? String((v as Record<string, unknown>).id ?? '') : String(v)
        return maps?.[field.name]?.get(raw) || raw
      }
      case 'datetime':
        return String(v).slice(0, 19).replace('T', ' ')
      default:
        return String(v)
    }
  }

  const relationsMaps = createMemo(() => rel.data)

  const rowItems = () => props.rows.map((row) => ({ row, maps: relationsMaps() }))

  const groups = () => {
    const field = groupField()
    if (!field || props.rows.length === 0) return []
    const map = new Map<string, { key: string; value: unknown; rows: RecordRow[] }>()
    for (const row of props.rows) {
      const key = groupKey(field, row)
      let g = map.get(key)
      if (!g) {
        g = { key, value: row[field.name], rows: [] }
        map.set(key, g)
      }
      g.rows.push(row)
    }
    return [...map.values()].sort((a, b) => {
      if (a.key === EMPTY_GROUP) return 1
      if (b.key === EMPTY_GROUP) return -1
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    })
  }

  const groupedItems = () =>
    groups().map((g) => ({
      value: g.value,
      key: g.key,
      rows: g.rows,
      maps: relationsMaps(),
      closed: collapsed().has(g.key),
    }))

  const toggleGroup = (key: string) => {
    setCollapsed((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const setGroupField = (field: string | null) => {
    setGroupBy(field)
    setCollapsed(new Set<string>())
    saveGroupBy(props.collection.name, field)
  }

  const groupsForHeader = () => {
    const runs: { label: string | null; span: number }[] = []
    for (const f of visibleCols()) {
      const label = f.group ? f.group : null
      const last = runs[runs.length - 1]
      if (last && (last.label ?? null) === label) last.span += 1
      else runs.push({ label, span: 1 })
    }
    return runs
  }
  const hasHeaderGroups = () => groupsForHeader().some((r) => r.label !== null)

  const startResize = (field: string, e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget as HTMLElement
    const th = handle.parentElement as HTMLElement
    const startX = e.clientX
    const startW = widths()[field] ?? th.getBoundingClientRect().width
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault()
      const w = Math.max(MIN_COL_WIDTH, Math.round(startW + ev.clientX - startX))
      setWidths((cur) => (cur[field] === w ? cur : { ...cur, [field]: w }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setResizing(null)
      saveWidths(props.collection.name, widths())
    }
    setResizing(field)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetWidth = (field: string) => {
    setWidths((cur) => {
      const next = { ...cur }
      delete next[field]
      saveWidths(props.collection.name, next)
      return next
    })
  }

  const colWidth = (name: string) => (widths()[name] ? `${widths()[name]}px` : undefined)

  const toggleField = (name: string) => {
    setVisible((cur) => {
      const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
      saveVisible(props.collection.name, next)
      return next
    })
  }

  const resetColumns = () => {
    const all = available().map((f) => f.name)
    saveVisible(props.collection.name, all)
    setVisible(all)
  }

  const visibleCols = () =>
    available().filter((f) => (visible() as string[]).includes(f.name))

  const idOf = (row: RecordRow) => String(row[props.collection.primaryKey ?? 'id'] ?? '')

  const toggleRow = (id: string) =>
    setChecked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allChecked = () => props.rows.length > 0 && props.rows.every((r) => checked().has(idOf(r)))

  const toggleAll = () =>
    setChecked((cur) => {
      const next = new Set(cur)
      const ids = props.rows.map((r) => idOf(r))
      if (ids.every((id) => next.has(id))) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })

  const clearChecked = () => setChecked(new Set<string>())

  const runBulkDelete = async () => {
    const ids = [...checked()]
    if (ids.length === 0) return
    const ok = await props.onBulkDelete?.(ids)
    if (ok) clearChecked()
  }

  const renderRow = (row: RecordRow, maps: Record<string, Map<string, string>> | undefined) => {
  return (
    <tr
      {...stylex.props(styles.tr, idOf(row) === props.selectedId && styles.trSelected)}
      onClick={() => props.onSelect(row)}
    >
      <Show when={checkedEnabled()}>
        <td {...stylex.props(styles.checkCell)} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked().has(idOf(row))}
            onChange={() => toggleRow(idOf(row))}
            aria-label="Select record"
            {...stylex.props(styles.rowCheck)}
          />
        </td>
      </Show>
      <For each={visibleCols()}>
        {(f) => (
          <td {...stylex.props(styles.td)}>
            <CellValue
              field={f}
              value={row[f.name]}
              relationLabels={maps?.[f.name]}
              locale={props.locale}
            />
          </td>
        )}
      </For>
      <td {...stylex.props(styles.td)}>
        <div {...stylex.props(styles.actions)}>
          <button
            type="button"
            title="Edit"
            aria-label="Edit"
            {...stylex.props(s.btnIcon, s.btnIconSm)}
            onClick={(e) => {
              e.stopPropagation()
              props.onSelect(row)
            }}
          >
            <PencilIcon size={14} />
          </button>
          <button
            type="button"
            title="Delete"
            aria-label="Delete"
            {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
            onClick={(e) => {
              e.stopPropagation()
              props.onDelete(row)
            }}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
  }

  return (
    <div {...stylex.props(styles.wrap)}>
      <div {...stylex.props(styles.toolbar)}>
        <span {...stylex.props(styles.toolbarMeta)}>
          {props.rows.length} {props.rows.length === 1 ? 'record' : 'records'}
        </span>
        <Show when={checkedEnabled() && checked().size > 0}>
          <div {...stylex.props(styles.selBar)}>
            <span {...stylex.props(styles.selText)}>{checked().size} selected</span>
            <button type="button" onClick={runBulkDelete} {...stylex.props(styles.selBtn, styles.selBtnDanger)}>
              Delete
            </button>
            <button type="button" onClick={clearChecked} {...stylex.props(styles.selBtn)}>
              Clear
            </button>
          </div>
        </Show>
        <Show when={open()}>
          <div {...stylex.props(styles.panel)}>
            <div {...stylex.props(styles.panelHeader)}>
              <span {...stylex.props(styles.panelTitle)}>Columns</span>
              <button type="button" onClick={resetColumns} {...stylex.props(styles.resetBtn)}>
                Reset
              </button>
            </div>
            <For each={available()}>
              {(f) => (
                <label {...stylex.props(styles.colItem)}>
                  <input
                    type="checkbox"
                    checked={(visible() as string[]).includes(f.name)}
                    onChange={() => toggleField(f.name)}
                    {...stylex.props(styles.colCheck)}
                  />
                  <span>{fieldLabel(f)}</span>
                </label>
              )}
            </For>
          </div>
        </Show>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Toggle columns"
          {...stylex.props(styles.columnsBtn)}
        >
          <ColumnsIcon size={14} />
          Columns
        </button>
      </div>
      <div {...stylex.props(styles.filterBar)}>
        <input
          type="text"
          placeholder="Search…"
          value={props.search ?? ''}
          onInput={(e) => props.onSearchChange?.(e.currentTarget.value)}
          {...stylex.props(styles.filterInput)}
        />
        <Show when={props.search}>
          <button
            type="button"
            onClick={() => props.onSearchChange?.('')}
            {...stylex.props(styles.filterClear)}
          >
            Clear
          </button>
        </Show>
        <div {...stylex.props(styles.groupByRow)}>
          <span {...stylex.props(styles.groupByLabel)}>Group by</span>
          <select
            {...stylex.props(styles.groupSelect)}
            onInput={(e) => setGroupField(e.currentTarget.value || null)}
          >
            <option value="" selected={!groupBy()}>
              None
            </option>
            <For each={groupable()}>
              {(f) => (
                <option value={f.name} selected={groupBy() === f.name}>
                  {fieldLabel(f)}
                </option>
              )}
            </For>
          </select>
        </div>
      </div>
      <Show
        when={props.rows.length > 0}
        fallback={
          <div {...stylex.props(styles.empty)}>
            {props.search ? 'No records match the search.' : 'No records yet.'}
          </div>
        }
      >
        <div {...stylex.props(styles.tableScroll)}>
          <table {...stylex.props(styles.table)}>
          <colgroup>
            <Show when={checkedEnabled()}>
              <col style={{ width: '36px' }} />
            </Show>
            <For each={visibleCols()}>
              {(f) => <col style={{ width: colWidth(f.name) }} />}
            </For>
            <col {...stylex.props(styles.actionsCol)} />
          </colgroup>
          <thead>
            <Show when={hasHeaderGroups()}>
              <tr>
                <Show when={checkedEnabled()}>
                  <th colSpan={1} {...stylex.props(styles.thGroup)} />
                </Show>
                <For each={groupsForHeader()}>
                  {(run) => (
                    <th colSpan={run.span} {...stylex.props(styles.thGroup)}>
                      {run.label ?? ''}
                    </th>
                  )}
                </For>
                <th colSpan={1} {...stylex.props(styles.thGroup)} />
              </tr>
            </Show>
            <tr>
              <Show when={checkedEnabled()}>
                <th {...stylex.props(styles.th, styles.checkCol)}>
                  <input
                    type="checkbox"
                    checked={allChecked()}
                    onChange={toggleAll}
                    aria-label="Select all records on this page"
                    {...stylex.props(styles.rowCheck)}
                  />
                </th>
              </Show>
              <For each={visibleCols()}>
                {(f) => {
                  const active = props.sortBy === f.name
                  const dir = active ? props.sortDir : null
                  return (
                    <th
                      {...stylex.props(styles.th, styles.thSortable, active && styles.thActive)}
                      onClick={() => props.onSort?.(f.name)}
                      title={`Sort by ${fieldLabel(f)}`}
                    >
                      <span {...stylex.props(styles.thLabel)}>
                        <span>{fieldLabel(f)}</span>
                        {dir === 'asc' && (
                          <span {...stylex.props(styles.sortIcon)}>
                            <ChevronUpIcon size={12} />
                          </span>
                        )}
                        {dir === 'desc' && (
                          <span {...stylex.props(styles.sortIcon)}>
                            <ChevronDownIcon size={12} />
                          </span>
                        )}
                      </span>
                      <div
                        {...stylex.props(styles.resizeHandle, resizing() === f.name && styles.resizeHandleActive)}
                        title="Drag to resize · double-click to reset"
                        onPointerDown={(e) => startResize(f.name, e)}
                        onClick={(e) => e.stopPropagation()}
                        onDblClick={(e) => {
                          e.stopPropagation()
                          resetWidth(f.name)
                        }}
                      />
                    </th>
                  )
                }}
              </For>
              <th {...stylex.props(styles.th, styles.actionsCol)} />
            </tr>
          </thead>
          <tbody>
            <Show
              when={groupField() !== null}
              fallback={<For each={rowItems()}>{(p) => renderRow(p.row, p.maps)}</For>}
            >
              <For each={groupedItems()}>
                {(g) => {
                  const field = groupField()!
                  const text = groupValueText(field, g.value, g.maps)
                  return (
                    <>
                      <tr
                        {...stylex.props(styles.groupRow)}
                        onClick={() => toggleGroup(g.key)}
                      >
                        <td
                          colSpan={visibleCols().length + 1 + (checkedEnabled() ? 1 : 0)}
                          {...stylex.props(styles.groupCell)}
                        >
                          <span {...stylex.props(styles.groupValueRow)}>
                            <span {...stylex.props(styles.groupValue)}>
                              <Show
                                when={field.type === 'enum' || field.type === 'relation' || field.type === 'boolean'}
                              >
<span
                                    {...stylex.props(
                                      styles.chip,
                                      field.type === 'relation'
                                        ? styles.chipAccent
                                        : field.type === 'boolean'
                                          ? text === 'Yes'
                                            ? styles.chipOk
                                            : styles.chipNeutral
                                          : styles.chipAccent,
                                    )}
                                  >
                                  {text}
                                </span>
                              </Show>
                              <Show when={!(field.type === 'enum' || field.type === 'relation' || field.type === 'boolean')}>
                                {text}
                              </Show>
                            </span>
                            <span {...stylex.props(styles.groupCount)}>{g.rows.length}</span>
                            <span
                              {...stylex.props(styles.groupChevron, g.closed && styles.groupChevronClosed)}
                            >
                              <ChevronDownIcon size={12} />
                            </span>
                          </span>
                        </td>
                      </tr>
                      <Show when={!g.closed}>
                        <For each={g.rows}>{(row) => renderRow(row, g.maps)}</For>
                      </Show>
                    </>
                  )
                }}
              </For>
            </Show>
          </tbody>
        </table>
        </div>
      </Show>
    </div>
  )
}