/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import * as stylex from '@stylexjs/stylex'
import type { CollectionDefinition, ConsoleView, FieldDefinition } from '@hamolus/types'
import { buildEntitySchema } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { FormInput } from './FormInput'
import { Collapsible } from './Collapsible'
import { titleCase } from '../lib/labels'
import type { RecordRow } from '../hooks/records'

const styles = stylex.create({
  layout: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  card: {
    flex: '1 1 420px',
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: 20,
  },
  sidebar: {
    flex: '0 1 230px',
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: 16,
    '@media (max-width: 900px)': {
      flexBasis: '100%',
    },
  },
  busy: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
  slotHeader: {
    paddingBottom: 14,
    marginBottom: 14,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
  },
  slotFooter: {
    paddingTop: 14,
    marginTop: 14,
    boxShadow: `inset 0 1px 0 0 ${tokens.border}`,
  },
  slotSide: {
    marginBottom: 14,
    paddingBottom: 14,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
  },
  groupGap: {
    marginBottom: 6,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 14,
  },
  actionBtn: {
    justifyContent: 'center',
    width: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: tokens.border,
    margin: '10px 0 12px',
  },
  metaTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color: tokens.textDim,
    marginBottom: 8,
  },
  metaItem: {
    fontSize: 12,
    color: tokens.textDim,
    marginBottom: 6,
    wordBreak: 'break-all',
  },
  metaKey: {
    display: 'block',
    fontSize: 10,
    color: tokens.textDim,
  },
  metaValue: {
    color: tokens.text,
    fontFamily: tokens.fontMono,
    fontSize: 11,
  },
})

function defaultsFor(def: CollectionDefinition, record?: RecordRow | null, languages?: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of def.fields) {
    if (f.type === 'id') continue
    const existing = record?.[f.name]
    if (existing !== undefined && existing !== null) {
      out[f.name] = existing
      continue
    }
    if (f.default !== undefined) out[f.name] = f.default
    else if (f.type === 'boolean') out[f.name] = false
    else if (f.localized && languages && languages.length > 0) {
      const obj: Record<string, string> = {}
      for (const lang of languages) obj[lang] = ''
      out[f.name] = obj
    } else out[f.name] = ''
  }
  return out
}

/** Order field groups by first appearance; ungrouped fields render inline between groups. */
interface FieldBlock {
  group?: string
  open?: boolean
  fields: FieldDefinition[]
}

function splitToGroups(fields: FieldDefinition[]): FieldBlock[] {
  const blocks: FieldBlock[] = []
  let inline: FieldDefinition[] = []
  const flushInline = () => {
    if (inline.length > 0) {
      blocks.push({ fields: inline })
      inline = []
    }
  }
  for (const f of fields) {
    if (f.group) {
      const existing = blocks.find((b) => b.group === f.group)
      if (existing) {
        flushInline()
        existing.fields.push(f)
      } else {
        flushInline()
        blocks.push({ group: f.group, open: f.groupOpen, fields: [f] })
      }
    } else {
      inline.push(f)
    }
  }
  flushInline()
  return blocks
}

function slotView(view: ConsoleView | undefined): ConsoleView {
  return view ?? 'normal'
}

export function RecordForm(props: {
  collection: CollectionDefinition
  record?: RecordRow | null
  busy?: boolean
  submitLabel?: string
  formId?: string
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void
  onCancel?: () => void
  onDelete?: (row: RecordRow) => void
  onDirtyChange?: (dirty: boolean) => void
  languages?: string[]
  locale?: string
}) {
  const [values, setValues] = createStore<Record<string, unknown>>(
    defaultsFor(props.collection, props.record, props.languages),
  )
  const [dirty, setDirty] = createSignal(false)
  createEffect(() => props.onDirtyChange?.(dirty()))
  createEffect(
    on(
      () => props.record,
      (r: RecordRow | null | undefined) => {
        setValues(defaultsFor(props.collection, r ?? null, props.languages))
        setDirty(false)
      },
      { defer: true },
    ),
  )
  const [error, setError] = createSignal<string | null>(null)

  const editableFields = () => props.collection.fields.filter((f) => f.type !== 'id' && !f.hidden)
  const byView = (view: ConsoleView) => () =>
    editableFields().filter((f) => slotView(f.consoleView) === view)
  const pk = props.collection.primaryKey ?? 'id'

  const submit = async (e: Event) => {
    e.preventDefault()
    setError(null)

    const valuesOut: Record<string, unknown> = { ...values }
    for (const f of props.collection.fields) {
      if (f.type !== 'json') continue
      const raw = valuesOut[f.name]
      if (typeof raw === 'string' && raw.trim() !== '') {
        try {
          valuesOut[f.name] = JSON.parse(raw)
        } catch {
          setError(`Field '${f.name}' is not valid JSON`)
          return
        }
      }
    }
    for (const f of props.collection.fields) {
      if (f.type === 'id') continue
      if (valuesOut[f.name] === '' && !f.required) valuesOut[f.name] = null
    }

    const parsed = buildEntitySchema(props.collection, props.languages).safeParse(valuesOut)
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${String(i.path)}: ${i.message}`).join('; '))
      return
    }
    await props.onSubmit(parsed.data)
    setDirty(false)
  }

  const metaItems = () => {
    if (!props.record) return []
    const out: Array<[string, string]> = []
    out.push([pk, String(props.record[pk] ?? '')])
    if ('created_at' in props.record || 'updated_at' in props.record) {
      const created = props.record.created_at
      const updated = props.record.updated_at
      if (created) out.push(['created', String(created)])
      if (updated) out.push(['updated', String(updated)])
    }
    return out
  }

  const renderField = (f: FieldDefinition) => (
    <FormInput
      field={f}
      value={() => values[f.name]}
      onChange={(v) => {
        setValues(f.name, v)
        setDirty(true)
      }}
      languages={props.languages}
      locale={props.locale}
    />
  )

  const renderBlocks = (fields: FieldDefinition[], sectionId: string) => {
    const blocks = splitToGroups(fields)
    return (
      <For each={blocks}>
        {(block) =>
          block.group ? (
            <div {...stylex.props(styles.groupGap)}>
              <Collapsible
                id={`${sectionId}:${props.collection.name}:${block.group}`}
                title={titleCase(block.group)}
                defaultOpen={block.open ?? true}
              >
                <For each={block.fields}>{renderField}</For>
              </Collapsible>
            </div>
          ) : (
            <For each={block.fields}>{renderField}</For>
          )
        }
      </For>
    )
  }

  return (
    <div {...stylex.props(styles.layout)}>
      <form
        {...stylex.props(styles.card, props.busy && styles.busy)}
        onSubmit={submit}
        id={props.formId ?? 'record-form'}
      >
        <Show when={byView('header')().length > 0}>
          <div {...stylex.props(styles.slotHeader)}>
            {renderBlocks(byView('header')(), 'header')}
          </div>
        </Show>

        {renderBlocks(byView('normal')(), 'normal')}

        <Show when={byView('footer')().length > 0}>
          <div {...stylex.props(styles.slotFooter)}>
            {renderBlocks(byView('footer')(), 'footer')}
          </div>
        </Show>

        <Show when={error()}>
          <p {...stylex.props(s.error)}>{error()}</p>
        </Show>
      </form>

      <aside {...stylex.props(styles.sidebar)}>
        <Show when={byView('side')().length > 0}>
          <div {...stylex.props(styles.slotSide)}>
            {renderBlocks(byView('side')(), 'side')}
          </div>
        </Show>

        <div {...stylex.props(styles.actions)}>
          <button
            type="submit"
            form={props.formId ?? 'record-form'}
            disabled={props.busy}
            {...stylex.props(s.btn, styles.actionBtn)}
          >
            {props.submitLabel ?? (props.record ? 'Save changes' : 'Create')}
          </button>
          {props.onCancel && (
            <button
              type="button"
              onClick={props.onCancel}
              {...stylex.props(s.btn, s.btnGhost, styles.actionBtn)}
            >
              Cancel
            </button>
          )}
          {props.record && props.onDelete && (
            <>
              <div {...stylex.props(styles.divider)} />
              <button
                type="button"
                onClick={() => props.onDelete?.(props.record as RecordRow)}
                {...stylex.props(s.btn, s.btnDanger, styles.actionBtn)}
              >
                Delete record
              </button>
            </>
          )}
        </div>

        <Show when={props.record}>
          <div {...stylex.props(styles.metaTitle)}>Details</div>
          <Show
            when={metaItems().length > 0}
            fallback={<div {...stylex.props(styles.metaItem)}>—</div>}
          >
            <For each={metaItems()}>
              {([k, v]) => (
                <div {...stylex.props(styles.metaItem)}>
                  <span {...stylex.props(styles.metaKey)}>{k}</span>
                  <span {...stylex.props(styles.metaValue)}>{v}</span>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </aside>
    </div>
  )
}