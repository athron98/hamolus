import { createMemo, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import {
  CONSOLE_VIEWS,
  CONTROL_TYPES,
  FIELD_TYPES,
  RELATION_ACTIONS,
  RELATION_KINDS,
  RICHTEXT_FORMATS,
  allowedControls,
  type ControlType,
  type FieldDefinition,
  type RelationAction,
  type RelationConfig,
  type RelationKind,
  type RichTextFormat,
} from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from './Icons'
import { fieldLabel } from '../lib/labels'

const TOGGLE_KEYS = ['required', 'unique', 'indexed', 'localized', 'hidden'] as const

const styles = stylex.create({
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: 14,
    marginBottom: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  index: {
    fontSize: 11,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
    flexShrink: 0,
    width: 18,
  },
  typeSelect: {
    flexShrink: 0,
    minWidth: 110,
  },
  spacer: {
    flex: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    marginBottom: 10,
    '@media (max-width: 700px)': {
      gridTemplateColumns: '1fr',
    },
  },
  toggles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  toggleBtn: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
    background: tokens.surfaceRaised,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease',
    ':hover': { color: tokens.text },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  toggleOn: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
})

function toggleValue(
  f: FieldDefinition,
  key: (typeof TOGGLE_KEYS)[number],
): boolean {
  const v = (f as unknown as Record<string, unknown>)[key]
  return v === true
}

function parseDefault(v: string): unknown {
  const t = v.trim()
  if (t === '') return undefined
  try {
    return JSON.parse(t)
  } catch {
    return v
  }
}

function defaultText(f: FieldDefinition): string {
  if (f.default === undefined || f.default === null) return ''
  return typeof f.default === 'string' ? f.default : JSON.stringify(f.default)
}

export function FieldEditor(props: {
  field: FieldDefinition
  index: number
  onChange: (patch: Partial<FieldDefinition>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const f = () => props.field
  const type = createMemo(() => f().type)

  const set = (patch: Partial<FieldDefinition>) => props.onChange(patch)
  const num = (v: string): number | undefined =>
    v === '' ? undefined : Math.round(Number(v))
  const freeNum = (v: string): number | undefined => (v === '' ? undefined : Number(v))

  const setRelation = (patch: {
    collection?: string
    field?: string
    kind?: string
    onDelete?: string
  }) => {
    const cur = f().relation
    const next: RelationConfig = {
      collection: patch.collection !== undefined ? patch.collection : (cur?.collection ?? ''),
      field: patch.field !== undefined ? patch.field : (cur?.field ?? 'id'),
    }
    const kind = patch.kind !== undefined ? patch.kind : (cur?.kind ?? 'belongsTo')
    next.kind = kind as RelationKind
    const onDelete = patch.onDelete !== undefined ? patch.onDelete : cur?.onDelete ?? ''
    if (onDelete) next.onDelete = onDelete as RelationAction
    if (!allowedControls({ type: 'relation', relation: next }).includes(f().control as ControlType)) {
      set({ relation: next, control: undefined })
    } else {
      set({ relation: next })
    }
  }

  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.header)}>
        <span {...stylex.props(styles.index)}>#{props.index + 1}</span>
        <select
          {...stylex.props(s.select, styles.typeSelect)}
          style={{ width: 'auto', 'min-width': '110px' }}
          title="Field type"
          onInput={(e) => {
            const t = e.currentTarget.value as FieldDefinition['type']
            const patch: Partial<FieldDefinition> = { type: t, format: undefined }
            // A control valid on the previous type may be meaningless on the
            // new one (e.g. `toggle` is boolean-only) — strip it.
            if (!allowedControls({ type: t, relation: f().relation }).includes(f().control as ControlType)) {
              patch.control = undefined
            }
            set(patch)
          }}
        >
          <For each={FIELD_TYPES}>
            {(t) => <option value={t} selected={t === type()}>{t}</option>}
          </For>
        </select>
        <span {...stylex.props(styles.spacer)} />
        <button
          type="button"
          title="Move up"
          aria-label="Move field up"
          {...stylex.props(s.btnIcon, s.btnIconSm)}
          onClick={() => props.onMove(-1)}
        >
          <ChevronUpIcon size={14} />
        </button>
        <button
          type="button"
          title="Move down"
          aria-label="Move field down"
          {...stylex.props(s.btnIcon, s.btnIconSm)}
          onClick={() => props.onMove(1)}
        >
          <ChevronDownIcon size={14} />
        </button>
        <button
          type="button"
          title="Remove field"
          aria-label="Remove field"
          {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
          onClick={props.onRemove}
        >
          <TrashIcon size={14} />
        </button>
      </div>

      <div {...stylex.props(styles.grid)}>
        <div>
          <label {...stylex.props(s.label)}>Name</label>
          <input
            {...stylex.props(s.input)}
            value={f().name}
            placeholder="snake_case"
            onInput={(e) => set({ name: e.currentTarget.value })}
          />
        </div>
        <div>
          <label {...stylex.props(s.label)}>Label</label>
          <input
            {...stylex.props(s.input)}
            value={f().label ?? ''}
            placeholder={fieldLabel(f())}
            onInput={(e) => set({ label: e.currentTarget.value || undefined })}
          />
        </div>

        <Show when={type() === 'number'}>
          <div>
            <label {...stylex.props(s.label)}>Min</label>
            <input
              {...stylex.props(s.input)}
              type="number"
              step="any"
              value={f().min ?? ''}
              onInput={(e) => set({ min: freeNum(e.currentTarget.value) })}
            />
          </div>
          <div>
            <label {...stylex.props(s.label)}>Max</label>
            <input
              {...stylex.props(s.input)}
              type="number"
              step="any"
              value={f().max ?? ''}
              onInput={(e) => set({ max: freeNum(e.currentTarget.value) })}
            />
          </div>
        </Show>

        <Show when={['string', 'text', 'slug', 'email', 'url'].includes(type())}>
          <div>
            <label {...stylex.props(s.label)}>Min length</label>
            <input
              {...stylex.props(s.input)}
              type="number"
              min={0}
              value={f().minLength ?? ''}
              onInput={(e) => set({ minLength: num(e.currentTarget.value) })}
            />
          </div>
          <div>
            <label {...stylex.props(s.label)}>Max length</label>
            <input
              {...stylex.props(s.input)}
              type="number"
              min={1}
              value={f().maxLength ?? ''}
              onInput={(e) => set({ maxLength: num(e.currentTarget.value) })}
            />
          </div>
        </Show>

        <Show when={type() === 'enum'}>
          <div>
            <label {...stylex.props(s.label)}>Values (comma-separated)</label>
            <input
              {...stylex.props(s.input)}
              value={(f().enumValues ?? []).join(', ')}
              onInput={(e) =>
                set({
                  enumValues: e.currentTarget.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter((v) => v.length > 0),
                })
              }
            />
          </div>
        </Show>

        <Show when={type() === 'relation'}>
          <div>
            <label {...stylex.props(s.label)}>Target collection</label>
            <input
              {...stylex.props(s.input)}
              value={f().relation?.collection ?? ''}
              placeholder="authors"
              onInput={(e) => setRelation({ collection: e.currentTarget.value })}
            />
          </div>
          <div>
            <label {...stylex.props(s.label)}>Target field</label>
            <input
              {...stylex.props(s.input)}
              value={f().relation?.field ?? ''}
              placeholder="id"
              onInput={(e) => setRelation({ field: e.currentTarget.value })}
            />
          </div>
          <div>
            <label {...stylex.props(s.label)}>Kind</label>
            <select
              {...stylex.props(s.select)}
              onInput={(e) => setRelation({ kind: e.currentTarget.value })}
            >
              <For each={RELATION_KINDS}>
                {(k) => (
                  <option value={k} selected={(f().relation?.kind ?? 'belongsTo') === k}>
                    {k}
                  </option>
                )}
              </For>
            </select>
          </div>
          <div>
            <label {...stylex.props(s.label)}>On delete</label>
            <select
              {...stylex.props(s.select)}
              onInput={(e) => setRelation({ onDelete: e.currentTarget.value })}
            >
              <option value="" selected={!f().relation?.onDelete}>— none —</option>
              <For each={RELATION_ACTIONS}>
                {(a) => (
                  <option value={a} selected={f().relation?.onDelete === a}>
                    {a}
                  </option>
                )}
              </For>
            </select>
          </div>
        </Show>
      </div>

      <div {...stylex.props(styles.toggles)}>
        <For each={TOGGLE_KEYS}>
          {(key) => {
            const on = toggleValue(f(), key)
            return (
              <button
                type="button"
                aria-pressed={on}
                {...stylex.props(styles.toggleBtn, on && styles.toggleOn)}
                onClick={() => set({ [key]: !on } as Partial<FieldDefinition>)}
              >
                {key}
              </button>
            )
          }}
        </For>
      </div>

      <div {...stylex.props(styles.grid)}>
        <div>
          <label {...stylex.props(s.label)}>Default</label>
          <input
            {...stylex.props(s.input)}
            value={defaultText(f())}
            placeholder={f().required ? 'no default (required)' : 'optional'}
            onInput={(e) => set({ default: parseDefault(e.currentTarget.value) })}
          />
        </div>
        <div>
          <label {...stylex.props(s.label)}>Console view</label>
          <select
            {...stylex.props(s.select)}
            onInput={(e) =>
              set({ consoleView: e.currentTarget.value as FieldDefinition['consoleView'] })
            }
          >
            <For each={CONSOLE_VIEWS}>
              {(v) => (
                <option value={v} selected={(f().consoleView ?? 'normal') === v}>
                  {v}
                </option>
              )}
            </For>
          </select>
        </div>
        <Show when={allowedControls(f()).length > 0}>
          <div>
            <label {...stylex.props(s.label)}>Control</label>
            <select
              {...stylex.props(s.select)}
              title="Input widget for the record form"
              onInput={(e) =>
                set({ control: (e.currentTarget.value || undefined) as ControlType | undefined })
              }
            >
              <option value="" selected={!f().control}>Default</option>
              <For each={allowedControls(f())}>
                {(c) => (
                  <option value={c} selected={f().control === c}>
                    {c}
                  </option>
                )}
              </For>
            </select>
          </div>
        </Show>
        <Show when={type() === 'richtext'}>
          <div>
            <label {...stylex.props(s.label)}>Rich-text format</label>
            <select
              {...stylex.props(s.select)}
              title="Rich-text format"
              onInput={(e) =>
                set({ format: e.currentTarget.value as RichTextFormat })
              }
            >
              <For each={RICHTEXT_FORMATS}>
                {(fmt) => (
                  <option value={fmt} selected={(f().format ?? 'lexical') === fmt}>
                    {fmt}
                  </option>
                )}
              </For>
            </select>
          </div>
        </Show>
        <div>
          <label {...stylex.props(s.label)}>Form group</label>
          <input
            {...stylex.props(s.input)}
            value={f().group ?? ''}
            placeholder="e.g. Publishing"
            onInput={(e) => set({ group: e.currentTarget.value || undefined })}
          />
        </div>
        <div>
          <label {...stylex.props(s.label)}>Start collapsed</label>
          <select
            {...stylex.props(s.select)}
            value={f().groupOpen === false ? 'yes' : 'no'}
            onInput={(e) =>
              set({ groupOpen: e.currentTarget.value === 'yes' ? false : undefined })
            }
          >
            <option value="no">no</option>
            <option value="yes">yes</option>
          </select>
        </div>
      </div>
    </div>
  )
}