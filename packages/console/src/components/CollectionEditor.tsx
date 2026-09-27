/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { CollectionDefinition, FieldDefinition, McpCollectionMode } from '@hamolus/types'
import { buildGroupTree, collectionDefinitionSchema, MCP_COLLECTION_MODES } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { JsonEditor } from './JsonEditor'
import { FieldEditor } from './FieldEditor'
import { COLLECTION_ICONS, CollectionIcon, PlusIcon, type CollectionIconName } from './Icons'
import { useGroups } from '../hooks/groups'

const DEFAULT_FIELDS_JSON = JSON.stringify(
  [
    { name: 'id', type: 'id', label: 'ID' },
    { name: 'title', type: 'string', required: true, label: 'Title', consoleView: 'header' },
    { name: 'slug', type: 'slug', required: true, unique: true, label: 'Slug' },
    { name: 'body', type: 'text', label: 'Body' },
    { name: 'notes', type: 'richtext', format: 'markdown', label: 'Notes' },
    { name: 'published', type: 'boolean', default: false, label: 'Published', group: 'Publishing' },
    { name: 'view_count', type: 'number', default: 0, label: 'Views', group: 'Publishing', groupOpen: false },
    {
      name: 'author_id',
      type: 'relation',
      relation: { collection: 'authors', field: 'id', onDelete: 'setNull' },
      label: 'Author',
      consoleView: 'side',
    },
    { name: 'tags', type: 'json', label: 'Tags', consoleView: 'footer' },
  ],
  null,
  2,
)

/**
 * What each MCP mode means, in the words the operator needs.
 *
 * The wording is deliberately about *effect*, not about the word: an operator
 * deciding this is not looking for a definition of "read", they are looking for
 * "can the agent delete my rows".
 */
const MCP_MODE_HINTS: Record<McpCollectionMode, string> = {
  read: 'The agent can read records through MCP, but cannot create, update or delete them. The default for a collection with no mode set.',
  write: 'The agent can read and change records through MCP. Required before any MCP write tool will touch this collection.',
  hide: 'The collection is invisible to MCP: not listed, not readable, and not editable through the MCP server.',
}

const styles = stylex.create({
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: 20,
    marginBottom: 22,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: 12,
    marginBottom: 12,
  },
  groupInput: {
    marginBottom: 12,
  },
  iconRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  iconPreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    flexShrink: 0,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radius,
    color: tokens.accent,
  },
  iconOptions: {
    flex: 1,
    minWidth: 0,
  },
  iconGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))',
    gap: 6,
    marginTop: 6,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    color: tokens.textDim,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  iconBtnActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    boxShadow: `0 0 0 1px ${tokens.accentSoft}`,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 15,
    height: 15,
    accentColor: tokens.accent,
    cursor: 'pointer',
  },
  fieldsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  modeSeg: {
    display: 'inline-flex',
    gap: 4,
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    padding: 3,
  },
  modeBtn: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  modeBtnActive: {
    color: tokens.text,
    backgroundColor: tokens.surfaceRaised,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 14,
  },
})

export function CollectionEditor(props: {
  initial?: CollectionDefinition | null
  busy?: boolean
  onSubmit: (def: CollectionDefinition) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const editing = !!props.initial
  const groupDefs = useGroups()
  const [dirty, setDirty] = createSignal(false)
  createEffect(() => props.onDirtyChange?.(dirty()))
  const touch = () => setDirty(true)
  const [name, setName] = createSignal(props.initial?.name ?? '')
  const [label, setLabel] = createSignal(props.initial?.label ?? '')
  const [group, setGroup] = createSignal(props.initial?.group ?? '')
  const [icon, setIcon] = createSignal(props.initial?.icon ?? '')
  const [timestamps, setTimestamps] = createSignal(props.initial?.timestamps ?? true)
  // Absent means the core's default, which is `read` — not `write`. Showing `read`
  // here is the point: the safe mode is the visible one.
  const [mcpMode, setMcpMode] = createSignal<McpCollectionMode>(props.initial?.mcp ?? 'read')
  const [fieldsJson, setFieldsJson] = createSignal(
    JSON.stringify(props.initial?.fields ?? JSON.parse(DEFAULT_FIELDS_JSON), null, 2),
  )
  const [mode, setMode] = createSignal<'json' | 'form'>('form')
  const [fields, setFields] = createSignal<FieldDefinition[]>(
    (props.initial?.fields ?? JSON.parse(DEFAULT_FIELDS_JSON)) as FieldDefinition[],
  )
  const [error, setError] = createSignal<string | null>(null)

  // Flatten the group tree into depth-indented select options.
  type GroupOpt = { id: string; label: string }
  const groupOpts = createMemo<GroupOpt[]>(() => {
    const out: GroupOpt[] = []
    const walk = (children: ReturnType<typeof buildGroupTree>, depth: number) => {
      for (const node of children) {
        out.push({ id: node.id, label: `${depth > 0 ? '· '.repeat(depth) : ''}${node.label}` })
        walk(node.children, depth + 1)
      }
    }
    walk(buildGroupTree(groupDefs.data ?? [], []), 0)
    return out
  })
  const isRegisteredGroup = () => groupOpts().some((o) => o.id === group())
  const [customGroup, setCustomGroup] = createSignal(false)
  createEffect(() => {
    // Switch between the registered-group picker and the free-text custom input.
    if (!group()) setCustomGroup(false)
    else if (groupDefs.data && isRegisteredGroup()) setCustomGroup(false)
  })

  const switchToForm = () => {
    setError(null)
    try {
      const parsed = JSON.parse(fieldsJson())
      if (!Array.isArray(parsed)) throw new Error('fields must be an array')
      setFields(parsed as FieldDefinition[])
      setMode('form')
    } catch (err) {
      setError(`Cannot switch to form: ${err instanceof Error ? err.message : 'invalid JSON'}`)
    }
  }

  const switchToJson = () => {
    setError(null)
    setFieldsJson(JSON.stringify(fields(), null, 2))
    setMode('json')
  }

  const updateField = (index: number, patch: Partial<FieldDefinition>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  const moveField = (index: number, dir: -1 | 1) => {
    setFields((prev) => {
      const j = index + dir
      if (j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  const addField = () => {
    setFields((prev) => [...prev, { name: '', type: 'string' }] as FieldDefinition[])
  }

  const submit = (e: Event) => {
    e.preventDefault()
    setError(null)

    let values: unknown
    try {
      values =
        mode() === 'form' ? JSON.parse(JSON.stringify(fields())) : JSON.parse(fieldsJson())
    } catch {
      setError('Field definitions are not valid JSON')
      return
    }

    const result = collectionDefinitionSchema.safeParse({
      name: name(),
      label: label(),
      group: group() || undefined,
      icon: icon() || undefined,
      timestamps: timestamps(),
      primaryKey: props.initial?.primaryKey ?? 'id',
      mcp: mcpMode(),
      fields: values,
    })
    if (!result.success) {
      setError(result.error.issues.map((i) => `${String(i.path)}: ${i.message}`).join('; '))
      return
    }
    props.onSubmit(result.data)
    setDirty(false)
  }

  return (
    <form {...stylex.props(styles.card)} onSubmit={submit}>
      <div {...stylex.props(styles.grid)}>
        <div>
          <label {...stylex.props(s.label)}>Name</label>
          <input
            {...stylex.props(s.input)}
            value={name()}
            disabled={editing}
            placeholder="posts"
            onInput={(e) => {
              setName(e.currentTarget.value)
              touch()
            }}
          />
        </div>
        <div>
          <label {...stylex.props(s.label)}>Label</label>
          <input
            {...stylex.props(s.input)}
            value={label()}
            placeholder="Posts"
            onInput={(e) => {
              setLabel(e.currentTarget.value)
              touch()
            }}
          />
        </div>
      </div>

      <div {...stylex.props(styles.groupInput)}>
        <label {...stylex.props(s.label)}>Group</label>
        {customGroup() ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              {...stylex.props(s.input)}
              value={group()}
              placeholder="Custom group (e.g. archive)"
              onInput={(e) => {
                setGroup(e.currentTarget.value.trim())
                touch()
              }}
            />
            <button
              type="button"
              title="Pick a registered group"
              aria-label="Pick a registered group"
              {...stylex.props(s.btnIcon)}
              onClick={() => {
                setGroup('')
                setCustomGroup(false)
              }}
            >
              <CollectionIcon name="folder" size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              {...stylex.props(s.select)}
              onChange={(e) => {
                const v = e.currentTarget.value
                if (v === '__custom__') {
                  setGroup('')
                  setCustomGroup(true)
                } else {
                  setGroup(v)
                  setCustomGroup(false)
                }
                touch()
              }}
            >
              <option value="" selected={!isRegisteredGroup()}>
                None (ungrouped)
              </option>
              <For each={groupOpts()}>
                {(opt) => (
                  <option value={opt.id} selected={group() === opt.id}>
                    {opt.label}
                  </option>
                )}
              </For>
              {isRegisteredGroup() && (
                <option value={group()} selected>
                  {group()}
                </option>
              )}
              <option value="__custom__">Custom…</option>
            </select>
            <button
              type="button"
              title="New group"
              aria-label="New group"
              {...stylex.props(s.btnIcon)}
              onClick={() => {
                setGroup('')
                setCustomGroup(true)
              }}
            >
              <PlusIcon size={15} />
            </button>
          </div>
        )}
      </div>

      <div {...stylex.props(styles.iconRow)}>
        <span {...stylex.props(styles.iconPreview)}>
          <CollectionIcon name={icon()} />
        </span>
        <div {...stylex.props(styles.iconOptions)}>
          <label {...stylex.props(s.label)}>Icon (shown in the sidebar nav)</label>
          <div {...stylex.props(styles.iconGrid)}>
            <button
              type="button"
              title="No icon"
              aria-label="No icon"
              onClick={() => {
                setIcon('')
                touch()
              }}
              {...stylex.props(styles.iconBtn, icon() === '' && styles.iconBtnActive)}
            >
              {/* blank */}
            </button>
            <For each={Object.keys(COLLECTION_ICONS) as CollectionIconName[]}>
              {(name) => (
                <button
                  type="button"
                  title={name}
                  aria-label={`Icon ${name}`}
                  aria-pressed={icon() === name}
                  onClick={() => {
                  setIcon(name)
                  touch()
                }}
                  {...stylex.props(styles.iconBtn, icon() === name && styles.iconBtnActive)}
                >
                  <CollectionIcon name={name} size={16} />
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      <div {...stylex.props(styles.checkboxRow)}>
        <input
          type="checkbox"
          checked={timestamps()}
          onInput={(e) => {
            setTimestamps(e.currentTarget.checked)
            touch()
          }}
          {...stylex.props(styles.checkbox)}
        />
        <span {...stylex.props(s.muted)}>Add created_at / updated_at columns automatically</span>
      </div>

      <div>
        <label {...stylex.props(s.label)}>MCP exposure</label>
        <div {...stylex.props(styles.modeSeg)} role="radiogroup" aria-label="MCP exposure">
          <For each={MCP_COLLECTION_MODES}>
            {(mode) => (
              <button
                type="button"
                role="radio"
                aria-checked={mcpMode() === mode}
                title={MCP_MODE_HINTS[mode]}
                onClick={() => {
                  if (mcpMode() === mode) return
                  setMcpMode(mode)
                  touch()
                }}
                {...stylex.props(styles.modeBtn, mcpMode() === mode && styles.modeBtnActive)}
              >
                {mode === 'read' ? 'Read only' : mode === 'write' ? 'Read + write' : 'Hidden'}
              </button>
            )}
          </For>
        </div>
        <p {...stylex.props(s.muted)}>{MCP_MODE_HINTS[mcpMode()]}</p>
      </div>

      <div {...stylex.props(styles.fieldsHeader)}>
        <label {...stylex.props(s.label)}>Fields</label>
        <div {...stylex.props(styles.modeSeg)} role="tablist" aria-label="Field editing mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode() === 'json'}
            onClick={mode() === 'form' ? switchToJson : undefined}
            {...stylex.props(styles.modeBtn, mode() === 'json' && styles.modeBtnActive)}
          >
            JSON
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode() === 'form'}
            onClick={mode() === 'json' ? switchToForm : undefined}
            {...stylex.props(styles.modeBtn, mode() === 'form' && styles.modeBtnActive)}
          >
            Form
          </button>
        </div>
      </div>

      <Show
        when={mode() === 'json'}
        fallback={
          <div>
            <For each={fields()}>
              {(f, i) => (
                <FieldEditor
                  field={f}
                  index={i()}
                  onChange={(patch) => {
                    updateField(i(), patch)
                    touch()
                  }}
                  onMove={(dir) => {
                    moveField(i(), dir)
                    touch()
                  }}
                  onRemove={() => {
                    removeField(i())
                    touch()
                  }}
                />
              )}
            </For>
            <button type="button" onClick={() => { addField(); touch() }} {...stylex.props(s.btn, s.btnGhost)}>
              <PlusIcon size={14} />
              Add field
            </button>
          </div>
        }
      >
        <JsonEditor
          value={fieldsJson}
          onChange={(v) => {
            setFieldsJson(v)
            touch()
          }}
          ariaLabel="Collection fields JSON"
        />
      </Show>

      <Show when={error()}>
        <p {...stylex.props(s.error)}>{error()}</p>
      </Show>

      <div {...stylex.props(styles.actions)}>
        <button type="submit" disabled={props.busy} {...stylex.props(s.btn)}>
          Save
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel} {...stylex.props(s.btn, s.btnGhost)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}