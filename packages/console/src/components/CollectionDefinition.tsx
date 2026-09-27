/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createMemo, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { CollectionDefinition, FieldDefinition } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { CollectionIcon } from './Icons'
import { fieldLabel } from '../lib/labels'

const chip = stylex.create({
  base: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
    marginRight: 4,
    marginBottom: 3,
  },
  neutral: {
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
  },
  accent: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  ok: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
})

const styles = stylex.create({
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowSm}`,
    borderRadius: tokens.radius,
    padding: 16,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
    marginBottom: 10,
  },
  divider: {
    height: 16,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    marginBottom: 14,
  },
  propsGrid: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    columnGap: 12,
    rowGap: 8,
    alignItems: 'baseline',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '120px 1fr',
    },
  },
  propLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: tokens.textDim,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
  },
  propValue: {
    fontSize: 13,
    color: tokens.text,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  mono: {
    fontFamily: tokens.fontMono,
    fontSize: 12,
  },
  dim: {
    color: tokens.textDim,
  },
  iconWrap: {
    color: tokens.accent,
    display: 'inline-flex',
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
      minWidth: 640,
    },
  },
  th: {
    textAlign: 'left',
    padding: '7px 10px',
    color: tokens.textDim,
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    verticalAlign: 'top',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fieldName: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 12,
    color: tokens.textDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  config: {
    fontSize: 12,
    color: tokens.textDim,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

function Flag({ label, tone }: { label: string; tone: 'neutral' | 'accent' | 'ok' }) {
  return (
    <span
      {...stylex.props(
        chip.base,
        tone === 'accent' && chip.accent,
        tone === 'ok' && chip.ok,
        tone === 'neutral' && chip.neutral,
      )}
    >
      {label}
    </span>
  )
}

function TypeChip({ type }: { type: string }) {
  return (
    <span {...stylex.props(chip.base, type === 'id' ? chip.neutral : chip.accent, styles.mono)}>
      {type}
    </span>
  )
}

function fieldFlags(f: FieldDefinition): { label: string; tone: 'neutral' | 'accent' | 'ok' }[] {
  const flags: { label: string; tone: 'neutral' | 'accent' | 'ok' }[] = []
  if (f.required) flags.push({ label: 'required', tone: 'accent' })
  if (f.unique) flags.push({ label: 'unique', tone: 'ok' })
  if (f.indexed) flags.push({ label: 'indexed', tone: 'neutral' })
  if (f.localized) flags.push({ label: 'localized', tone: 'neutral' })
  if (f.hidden) flags.push({ label: 'hidden', tone: 'neutral' })
  if (f.consoleView && f.consoleView !== 'normal') flags.push({ label: f.consoleView, tone: 'neutral' })
  if (f.group) flags.push({ label: `group:${f.group}`, tone: 'neutral' })
  if (f.type === 'richtext' && f.format) flags.push({ label: `format:${f.format}`, tone: f.format === 'lexical' ? 'neutral' : 'accent' })
  return flags
}

function fieldConfig(f: FieldDefinition): string {
  const parts: string[] = []
  if (f.type === 'relation' && f.relation) {
    const rel = f.relation
    parts.push(`→ ${rel.collection}.${rel.field}`)
    if (rel.kind && rel.kind !== 'belongsTo') parts.push(`kind:${rel.kind}`)
    if (rel.onDelete) parts.push(`onDelete:${rel.onDelete}`)
  }
  if (f.type === 'enum' && f.enumValues) parts.push(f.enumValues.join(' | '))
  if (f.min !== undefined && f.max !== undefined) parts.push(`${f.min}–${f.max}`)
  else {
    if (f.min !== undefined) parts.push(`min ${f.min}`)
    if (f.max !== undefined) parts.push(`max ${f.max}`)
  }
  if (f.minLength !== undefined && f.maxLength !== undefined) parts.push(`${f.minLength}–${f.maxLength} chars`)
  else {
    if (f.minLength !== undefined) parts.push(`min ${f.minLength}`)
    if (f.maxLength !== undefined) parts.push(`max ${f.maxLength}`)
  }
  if (f.default !== undefined) parts.push(`default ${JSON.stringify(f.default)}`)
  return parts.join(' · ')
}

export function CollectionDefinition({
  collection,
  groupLabel,
}: {
  collection: CollectionDefinition
  groupLabel?: (id: string | null | undefined) => string | null
}) {
  const def = createMemo(() => collection)

  const propsRows = createMemo<{ label: string; value: unknown }[]>(() => [
    { label: 'Name', value: def().name },
    { label: 'Label', value: def().label },
    { label: 'Description', value: def().description },
    { label: 'Group', value: groupLabel ? groupLabel(def().group) : def().group },
    { label: 'Icon', value: def().icon },
    { label: 'Primary key', value: def().primaryKey ?? 'id' },
    { label: 'Timestamps', value: def().timestamps ? 'Yes' : 'No' },
    { label: 'Soft delete', value: def().softDelete ? 'Yes' : 'No' },
    { label: 'Fields', value: String(def().fields.length) },
  ])

  const renderValue = (label: string, value: unknown) => {
    if (label === 'Icon' && value) {
      return (
        <>
          <span {...stylex.props(styles.iconWrap)}>
            <CollectionIcon name={String(value)} size={14} />
          </span>
          <span {...stylex.props(styles.mono)}>{String(value)}</span>
        </>
      )
    }
    const yesNo = label === 'Timestamps' || label === 'Soft delete'
    if (yesNo) {
      const yes = value === 'Yes'
      return (
        <span {...stylex.props(chip.base, yes ? chip.ok : chip.neutral)}>{String(value)}</span>
      )
    }
    if (value === undefined || value === null || value === '') {
      return <span {...stylex.props(styles.dim)}>—</span>
    }
    if (label === 'Name' || label === 'Primary key') {
      return <span {...stylex.props(styles.mono)}>{String(value)}</span>
    }
    return <span>{String(value)}</span>
  }

  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.sectionTitle)}>Properties</div>
      <div {...stylex.props(styles.propsGrid)}>
        <For each={propsRows()}>
          {(row) => (
            <>
              <span {...stylex.props(styles.propLabel)}>{row.label}</span>
              <span {...stylex.props(styles.propValue)}>{renderValue(row.label, row.value)}</span>
            </>
          )}
        </For>
      </div>
      <div {...stylex.props(styles.divider)} />
      <div {...stylex.props(styles.sectionTitle)}>Structure · {def().fields.length} fields</div>
      <div {...stylex.props(styles.tableScroll)}>
        <table {...stylex.props(styles.table)}>
          <thead>
            <tr>
              <th {...stylex.props(styles.th)}>Field</th>
              <th {...stylex.props(styles.th)}>Type</th>
              <th {...stylex.props(styles.th)}>Flags</th>
              <th {...stylex.props(styles.th)}>Config</th>
            </tr>
          </thead>
          <tbody>
            <For each={def().fields}>
              {(f) => (
                <tr>
                  <td {...stylex.props(styles.td)}>
                    <div {...stylex.props(styles.fieldName)}>
                      <span {...stylex.props(styles.mono)}>{f.name}</span>
                      <Show when={f.label && f.label !== fieldLabel(f)}>
                        <span {...stylex.props(styles.fieldLabel)}>{fieldLabel(f)}</span>
                      </Show>
                    </div>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <TypeChip type={f.type} />
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <For each={fieldFlags(f)}>
                      {(fl) => <Flag label={fl.label} tone={fl.tone} />}
                    </For>
                  </td>
                  <td {...stylex.props(styles.td)}>
                    <span {...stylex.props(styles.config)}>{fieldConfig(f) || '—'}</span>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}