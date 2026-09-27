/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { FieldDefinition } from '@hamolus/types'
import {
  DEFAULT_CURRENCY,
  formatCurrencyDisplay,
  formatCustomCurrencyDisplay,
  type ControlType,
} from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { useRelationContext, type RelationOption } from '../lib/relations'
import { LexicalEditor, type LexicalValue } from './LexicalEditor'
import { MarkdownEditor } from './MarkdownEditor'
import { LocalizedInput } from './LocalizedInput'
import { RelationChips } from './RelationChips'
import { MediaFieldInput } from './MediaFieldInput'
import { FileFieldInput } from './FileFieldInput'
import { RelatedRecordCreate } from './RelatedRecordCreate'
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from './Icons'
import { fieldLabel } from '../lib/labels'
import type { RecordRow } from '../lib/api'

const BOOL_OPTIONS: RelationOption[] = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

const styles = stylex.create({
  field: {
    marginBottom: 14,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
  },
  fieldRowMain: {
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: tokens.accent,
    cursor: 'pointer',
  },
  help: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
  },
  selectStatus: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
  },
  selectError: {
    fontSize: 11,
    color: tokens.danger,
    marginTop: 2,
  },
  selectOk: {
    fontSize: 11,
    color: tokens.ok,
    marginTop: 2,
  },
  comboWrap: {
    position: 'relative',
  },
  comboBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.surfaceRaised,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowInput}`,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    padding: '0 8px',
    transition: 'box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    ':focus-within': {
      boxShadow: `0 0 0 1px ${tokens.accentSoft}, ${tokens.shadowInputFocus}`,
    },
  },
  comboInput: {
    flex: 1,
    minWidth: 0,
    borderStyle: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: 13,
    color: tokens.text,
    padding: '9px 0',
  },
  clearBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: '50%',
    color: tokens.textDim,
    cursor: 'pointer',
    transition: 'color 0.12s ease, background-color 0.12s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.borderStrong },
  },
  caret: {
    display: 'inline-flex',
    color: tokens.textDim,
    pointerEvents: 'none',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadow}`,
    borderRadius: tokens.radius,
    maxHeight: 200,
    overflow: 'auto',
  },
  dropdownRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '7px 10px',
    fontSize: 13,
    color: tokens.text,
    cursor: 'pointer',
    transition: 'background-color 0.12s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  dropdownRowOn: {
    color: tokens.accent,
    fontWeight: 600,
  },
  empty: {
    padding: '10px 10px',
    fontSize: 12,
    color: tokens.textDim,
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  radioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: tokens.text,
    cursor: 'pointer',
  },
  checkWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: tokens.radiusSm,
    fontSize: 13,
    color: tokens.textDim,
    cursor: 'pointer',
    transition: 'background-color 0.12s ease, color 0.12s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised, color: tokens.text },
  },
  checkRowOn: {
    backgroundColor: tokens.accentSoft,
    color: tokens.accent,
    fontWeight: 600,
  },
  checkBox: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    flexShrink: 0,
    borderRadius: tokens.radiusSm,
    boxShadow: `inset 0 0 0 1px ${tokens.borderStrong}`,
    color: 'transparent',
    transition: 'background-color 0.12s ease, color 0.12s ease',
  },
  checkBoxOn: {
    backgroundColor: tokens.accent,
    color: '#ffffff',
    boxShadow: `inset 0 0 0 1px ${tokens.accent}`,
  },
  switchTrack: {
    position: 'relative',
    flexShrink: 0,
    width: 38,
    height: 22,
    padding: 0,
    backgroundColor: tokens.surfaceRaised,
    boxShadow: `inset 0 0 0 1px ${tokens.border}`,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'background-color 0.18s ease, box-shadow 0.18s ease',
  },
  switchTrackOn: {
    backgroundColor: tokens.accent,
    boxShadow: `inset 0 0 0 1px ${tokens.accent}`,
  },
  switchKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    backgroundColor: tokens.text,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
    transition: 'transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1)',
  },
  switchKnobOn: {
    transform: 'translateX(16px)',
    backgroundColor: '#ffffff',
  },
})

export function displayValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined) return ''
  switch (field.type) {
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    case 'datetime':
      return String(value).slice(0, 16)
    default:
      return String(value)
  }
}

/** Keep slug values safe while typing: lowercase a-z0-9, spaces → dashes. */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Field-level options for widgets that show a choice list (enum values or
 * relation candidates). Kept as an accessor so async relation data flows in.
 */
type ChoiceSource = () => RelationOption[]

function RelationSelect(props: {
  field: FieldDefinition
  value: () => unknown
  onChange: (value: unknown) => void
}) {
  const target = () => props.field.relation?.collection
  const q = useRelationContext(target)
  const data = () => q.data
  const currentVal = () => (props.value() == null ? '' : String(props.value()))

  return (
    <>
      <select
        {...stylex.props(s.select)}
        onInput={(e) => props.onChange(e.currentTarget.value || null)}
      >
        {!props.field.required && (
          <option value="" selected={currentVal() === ''}>— none —</option>
        )}
        <Show when={q.isLoading}>
          <option disabled>Loading…</option>
        </Show>
        <For each={data()?.options ?? []}>
          {(opt) => (
            <option value={opt.value} selected={currentVal() === opt.value}>
              {opt.label}
            </option>
          )}
        </For>
      </select>
      <Show when={target()}>
        <Show when={q.isLoading}>
          <div {...stylex.props(styles.selectStatus)}>Loading references…</div>
        </Show>
        <Show when={q.isError}>
          <div {...stylex.props(styles.selectError)}>
            Failed to load references from '{target()}'.
          </div>
        </Show>
        <Show when={!q.isError && data() && !data()!.def}>
          <div {...stylex.props(styles.selectError)}>
            Target collection '{target()}' is not registered in the API.
          </div>
        </Show>
        <Show when={!q.isError && data() && data()!.def}>
          <Show
            when={data()!.rows.length > 0}
            fallback={
              <div {...stylex.props(styles.selectOk)}>
                No records in '{target()}' yet — create one first.
              </div>
            }
          >
            <div {...stylex.props(styles.selectOk)}>
              Reference to '{target()}' · {data()!.rows.length} candidate
              {data()!.rows.length === 1 ? '' : 's'}
            </div>
          </Show>
        </Show>
      </Show>
    </>
  )
}

/**
 * Amount input for `currency` and `custom_currency`. The field stores a bare
 * number, so the widget edits the number and previews the formatted string the
 * API will hand back — the same string, from the same formatter, so the console
 * never has to reimplement the locale rules.
 */
function CurrencyInput(props: {
  field: FieldDefinition
  value: () => unknown
  onChange: (value: unknown) => void
  locale?: string
}) {
  const custom = () => props.field.type === 'custom_currency'
  const code = () => props.field.currency ?? DEFAULT_CURRENCY
  const base = () => {
    const v = props.value()
    if (v == null) return ''
    if (typeof v === 'object') return String((v as { base?: unknown }).base ?? '')
    return String(v)
  }
  const display = () => {
    const n = Number(base())
    if (!Number.isFinite(n) || n === 0) return ''
    return custom()
      ? formatCustomCurrencyDisplay(n, props.field.customCurrency, props.locale)
      : formatCurrencyDisplay(n, { code: code(), locale: props.locale })
  }
  const hint = () =>
    custom()
      ? 'Custom unit — the symbol and separators come from the field\'s customCurrency'
      : `Amount in ${code()} (e.g. 250000 → ${formatCurrencyDisplay(250000, { code: code(), locale: props.locale })})`
  return (
    <>
      <input
        type="number"
        step="any"
        min={props.field.min}
        max={props.field.max}
        {...stylex.props(s.input)}
        value={base()}
        onInput={(e) => {
          const v = e.currentTarget.value
          props.onChange(v === '' ? null : Number(v))
        }}
      />
      <div {...stylex.props(styles.help)}>
        {display() ? `${display()} · ${props.locale ?? 'id'}` : hint()}
        {props.field.min !== undefined && ` · min ${props.field.min}`}
        {props.field.max !== undefined && ` · max ${props.field.max}`}
      </div>
    </>
  )
}

/** Searchable single-select combo box (tag-input style, for many options). */
function SearchSelect(props: {
  options: ChoiceSource
  value: () => unknown
  onChange: (value: unknown) => void
  placeholder?: string
}) {
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const current = () => {
    const v = props.value()
    return v == null || v === '' ? '' : String(v)
  }
  const labelOf = (v: string) => props.options().find((o) => o.value === v)?.label ?? v
  const text = () => (open() ? query() : labelOf(current()))
  const filtered = () => {
    const q = query().toLowerCase()
    return props.options().filter(
      (o) => !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }
  const select = (v: string) => {
    props.onChange(v)
    setQuery('')
    setOpen(false)
  }
  return (
    <div {...stylex.props(styles.comboWrap)}>
      <div {...stylex.props(styles.comboBox)}>
        <input
          type="text"
          value={text()}
          placeholder={props.placeholder ?? 'Search…'}
          onFocus={() => {
            setQuery(labelOf(current()))
            setOpen(true)
          }}
          onInput={(e) => {
            setQuery(e.currentTarget.value)
            setOpen(true)
          }}
          onBlur={(e) => {
            // Commit a free-typed value when there is no match, mirroring tag input.
            const v = e.currentTarget.value
            if (v !== '' && !props.options().some((o) => o.label === v || o.value === v)) {
              props.onChange(v)
            }
            setTimeout(() => setOpen(false), 150)
          }}
          {...stylex.props(styles.comboInput)}
        />
        {current() !== '' && (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={(e) => {
              e.preventDefault()
              props.onChange(null)
              setQuery('')
            }}
            {...stylex.props(styles.clearBtn)}
          >
            <XIcon size={11} />
          </button>
        )}
        <span {...stylex.props(styles.caret)}>
          <ChevronDownIcon size={12} />
        </span>
      </div>
      <Show when={open() && filtered().length > 0}>
        <div {...stylex.props(styles.dropdown)}>
          <For each={filtered()}>
            {(opt) => (
              <div
                {...stylex.props(styles.dropdownRow, opt.value === current() && styles.dropdownRowOn)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(opt.value)}
              >
                <span>{opt.label}</span>
                {opt.value === current() && <CheckIcon size={12} strokeWidth={2.4} />}
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={open() && filtered().length === 0}>
        <div {...stylex.props(styles.dropdown)}>
          <div {...stylex.props(styles.empty)}>No options match “{query()}”.</div>
        </div>
      </Show>
    </div>
  )
}

/** Inline radio group — good when the choice set is small. */
function RadioGroup(props: {
  name: string
  options: ChoiceSource
  value: () => unknown
  onChange: (value: unknown) => void
  required?: boolean
}) {
  const current = () => {
    const v = props.value()
    return v == null ? null : String(v)
  }
  return (
    <div {...stylex.props(styles.radioGroup)}>
      {!props.required && (
        <label {...stylex.props(styles.radioRow)}>
          <input
            type="radio"
            name={props.name}
            checked={current() === null}
            onInput={() => props.onChange(null)}
            {...stylex.props(styles.checkbox)}
          />
          — none —
        </label>
      )}
      <For each={props.options()}>
        {(opt) => (
          <label {...stylex.props(styles.radioRow)}>
            <input
              type="radio"
              name={props.name}
              checked={current() === opt.value}
              onInput={() => props.onChange(opt.value)}
              {...stylex.props(styles.checkbox)}
            />
            {opt.label}
          </label>
        )}
      </For>
    </div>
  )
}

/** Pick ONE from a list of rows (single-select checklist). */
function Checklist(props: {
  options: ChoiceSource
  value: () => unknown
  onChange: (value: unknown) => void
  required?: boolean
}) {
  const current = () => {
    const v = props.value()
    return v == null || v === '' ? null : String(v)
  }
  const choose = (v: string) => props.onChange(v)
  return (
    <div {...stylex.props(styles.checkWrapper)}>
      <For each={props.options()}>
        {(opt) => {
          const active = current() === opt.value
          return (
            <div
              role="option"
              aria-selected={active}
              {...stylex.props(styles.checkRow, active && styles.checkRowOn)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(active && !props.required ? '' : opt.value)}
            >
              <span {...stylex.props(styles.checkBox, active && styles.checkBoxOn)}>
                {active && <CheckIcon size={11} strokeWidth={2.8} />}
              </span>
              <span>{opt.label}</span>
            </div>
          )
        }}
      </For>
      {!props.required && current() !== null && (
        <button
          type="button"
          onClick={() => props.onChange(null)}
          {...stylex.props(s.btn, s.btnGhost)}
          style={{ 'margin-top': '6px', padding: '3px 10px', 'font-size': '12px' }}
        >
          Clear selection
        </button>
      )}
    </div>
  )
}

/** Pick MANY with checkboxes — value is an array of option values. */
function MultiChecklist(props: {
  options: ChoiceSource
  value: () => unknown
  onChange: (value: unknown) => void
}) {
  const selected = () => {
    const v = props.value()
    return Array.isArray(v) ? (v as string[]) : []
  }
  const toggle = (v: string, on: boolean) => {
    const cur = selected()
    props.onChange(on ? [...cur, v] : cur.filter((x) => x !== v))
  }
  const order = () => {
    const byIndex = new Map(props.options().map((o, i) => [o.value, i]))
    return [...selected()]
      .filter((v) => byIndex.has(v))
      .sort((a, b) => (byIndex.get(a) ?? 0) - (byIndex.get(b) ?? 0))
  }
  return (
    <div {...stylex.props(styles.checkWrapper)}>
      <For each={props.options()}>
        {(opt) => {
          const on = selected().includes(opt.value)
          return (
            <label {...stylex.props(styles.checkRow)}>
              <input
                type="checkbox"
                checked={on}
                onInput={(e) => toggle(opt.value, e.currentTarget.checked)}
                {...stylex.props(styles.checkbox)}
              />
              <span>{opt.label}</span>
            </label>
          )
        }}
      </For>
      {selected().length > 0 && order().join(', ') && (
        <div {...stylex.props(styles.help)}>Selected: {order().join(', ')}</div>
      )}
    </div>
  )
}

/** On/off switch for boolean fields. */
function Toggle(props: { value: () => unknown; onChange: (value: unknown) => void }) {
  const on = () => !!props.value()
  return (
    <div {...stylex.props(styles.row)}>
      <button
        type="button"
        role="switch"
        aria-checked={on()}
        onClick={() => props.onChange(!on())}
        {...stylex.props(styles.switchTrack, on() && styles.switchTrackOn)}
      >
        <span {...stylex.props(styles.switchKnob, on() && styles.switchKnobOn)} />
      </button>
      <span {...stylex.props(styles.help)}>{on() ? 'on' : 'off'}</span>
    </div>
  )
}

/** Resolve the ChoiceSource for a field, given its current control. */
function useChoices(
  field: FieldDefinition,
): () => RelationOption[] {
  if (field.type === 'relation') {
    const q = useRelationContext(() => field.relation?.collection)
    return () => q.data?.options ?? []
  }
  return () => (field.enumValues ?? []).map((v) => ({ value: v, label: v }))
}

export function FormInput(props: {
  field: FieldDefinition
  value: () => unknown
  onChange: (value: unknown) => void
  languages?: string[]
  locale?: string
}) {
  const { field, value, onChange } = props
  const fieldType = field.type
  const control: ControlType | undefined = field.control
  const isMulti = fieldType === 'enum' && control === 'multichecklist'
  const choices = useChoices(field)

  if (field.localized && props.languages && props.languages.length > 0) {
    return (
      <div {...stylex.props(styles.field)}>
        <label {...stylex.props(s.label)}>
          {fieldLabel(field)}
          {field.required ? ' *' : ''}
          <span style={{ 'font-weight': '400', 'font-style': 'italic', 'margin-left': '4px' }}>localized</span>
        </label>
        <LocalizedInput
          field={field}
          value={value}
          onChange={onChange}
          languages={props.languages}
          initialLocale={props.locale}
        />
      </div>
    )
  }

  return (
    <div {...stylex.props(styles.field)}>
      <label {...stylex.props(s.label)}>
        {fieldLabel(field)}
        {field.required ? ' *' : ''}
      </label>

      {fieldType === 'boolean' ? (
        control === 'toggle' ? (
          <Toggle value={value} onChange={onChange} />
        ) : control === 'radio' ? (
          <div {...stylex.props(styles.radioGroup)}>
            {!field.required && (
              <label {...stylex.props(styles.radioRow)}>
                <input
                  type="radio"
                  name={field.name}
                  checked={value() == null}
                  onInput={() => onChange(null)}
                  {...stylex.props(styles.checkbox)}
                />
                — none —
              </label>
            )}
            <label {...stylex.props(styles.radioRow)}>
              <input
                type="radio"
                name={field.name}
                checked={value() === true}
                onInput={() => onChange(true)}
                {...stylex.props(styles.checkbox)}
              />
              Yes
            </label>
            <label {...stylex.props(styles.radioRow)}>
              <input
                type="radio"
                name={field.name}
                checked={value() === false}
                onInput={() => onChange(false)}
                {...stylex.props(styles.checkbox)}
              />
              No
            </label>
          </div>
        ) : (
          <div {...stylex.props(styles.row)}>
            <input
              type="checkbox"
              checked={!!value()}
              onInput={(e) => onChange(e.currentTarget.checked)}
              {...stylex.props(styles.checkbox)}
            />
            <span {...stylex.props(styles.help)}>check for true</span>
          </div>
        )
      ) : fieldType === 'relation' ? (
        <RelationWidgetRow
          field={field}
          control={control}
          choices={choices}
          value={value}
          onChange={onChange}
          languages={props.languages}
        />
      ) : fieldType === 'enum' ? (
        control === 'search' ? (
          <SearchSelect options={choices} value={value} onChange={onChange} placeholder="Search…" />
        ) : control === 'radio' ? (
          <RadioGroup name={field.name} options={choices} value={value} onChange={onChange} required={field.required} />
        ) : control === 'checklist' ? (
          <Checklist options={choices} value={value} onChange={onChange} required={field.required} />
        ) : control === 'multichecklist' ? (
          <MultiChecklist options={choices} value={value} onChange={onChange} />
        ) : (
          <select
            {...stylex.props(s.select)}
            onInput={(e) => onChange(e.currentTarget.value || null)}
          >
            <option value="" selected={value() == null ? true : String(value()) === ''}>
              — pick one —
            </option>
            {(field.enumValues ?? []).map((opt) => (
              <option value={opt} selected={value() != null && String(value()) === opt}>
                {opt}
              </option>
            ))}
          </select>
        )
      ) : fieldType === 'slug' ? (
        <input
          type="text"
          {...stylex.props(s.input)}
          value={value() == null ? '' : String(value())}
          onInput={(e) => onChange(normalizeSlug(e.currentTarget.value))}
        />
      ) : fieldType === 'number' ? (
        <input
          type="number"
          step="any"
          {...stylex.props(s.input)}
          value={value() == null ? '' : String(value())}
          onInput={(e) => {
            const v = e.currentTarget.value
            onChange(v === '' ? null : Number(v))
          }}
        />
      ) : fieldType === 'currency' || fieldType === 'custom_currency' ? (
        <CurrencyInput field={field} value={value} onChange={onChange} locale={props.locale} />
      ) : fieldType === 'date' ? (
        <input
          type="date"
          {...stylex.props(s.input)}
          value={displayValue(field, value())}
          onInput={(e) => onChange(e.currentTarget.value || null)}
        />
      ) : fieldType === 'datetime' ? (
        <input
          type="datetime-local"
          {...stylex.props(s.input)}
          value={displayValue(field, value())}
          onInput={(e) => {
            const v = e.currentTarget.value
            onChange(v ? new Date(v).toISOString() : null)
          }}
        />
      ) : fieldType === 'text' || fieldType === 'json' ? (
        <textarea
          {...stylex.props(s.textarea)}
          value={displayValue(field, value())}
          onInput={(e) => onChange(e.currentTarget.value)}
        />
      ) : fieldType === 'richtext' ? (
        field.format === 'markdown' || field.format === 'mdx' ? (
          <MarkdownEditor value={() => String(value() ?? '')} onChange={onChange} mode={field.format} placeholder="Start typing markdown…" />
        ) : (
          <LexicalEditor value={() => value() as LexicalValue} onChange={onChange} placeholder="Start typing…" />
        )
      ) : fieldType === 'media' ? (
        <MediaFieldInput value={value} onChange={(v) => onChange(v)} />
      ) : fieldType === 'document' ? (
        <FileFieldInput kind="document" value={value} onChange={(v) => onChange(v)} />
      ) : fieldType === 'attachment' ? (
        <FileFieldInput kind="attachment" value={value} onChange={(v) => onChange(v)} />
      ) : (
        <input
          type={fieldType === 'email' ? 'email' : fieldType === 'url' ? 'url' : 'text'}
          {...stylex.props(s.input)}
          value={displayValue(field, value())}
          onInput={(e) => onChange(e.currentTarget.value)}
        />
      )}
      {fieldType === 'slug' && (
        <div {...stylex.props(styles.help)}>auto-normalized: lowercase letters, digits, dashes</div>
      )}
      {isMulti && field.enumValues && field.enumValues.length > 0 && (
        <div {...stylex.props(styles.help)}>
          pick any number of {field.enumValues.length} option{field.enumValues.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

function RelationControl(props: {
  control: ControlType | undefined
  field: FieldDefinition
  choices: ChoiceSource
  value: () => unknown
  onChange: (value: unknown) => void
}) {
  if (props.control === 'search') {
    return <SearchSelect options={props.choices} value={props.value} onChange={props.onChange} placeholder="Search the target…" />
  }
  if (props.control === 'radio') {
    return (
      <RadioGroup
        name={props.field.name}
        options={props.choices}
        value={props.value}
        onChange={props.onChange}
        required={props.field.required}
      />
    )
  }
  if (props.control === 'checklist') {
    return <Checklist options={props.choices} value={props.value} onChange={props.onChange} required={props.field.required} />
  }
  return <RelationSelect field={props.field} value={props.value} onChange={props.onChange} />
}

/**
 * Relation field widget + a "+" button on the right that opens a popup to create
 * a new record in the target collection. Created records are auto-selected
 * (belongsTo) or appended (hasMany) via `onChange`.
 */
function RelationWidgetRow(props: {
  field: FieldDefinition
  control: ControlType | undefined
  choices: ChoiceSource
  value: () => unknown
  onChange: (value: unknown) => void
  languages?: string[]
}) {
  const target = () => props.field.relation?.collection
  const [creating, setCreating] = createSignal(false)

  const relationControl = () => {
    if (props.field.relation?.kind === 'hasMany') {
      if (props.control === 'multichecklist') {
        return <MultiChecklist options={props.choices} value={props.value} onChange={props.onChange} />
      }
      return <RelationChips field={props.field} value={props.value} onChange={props.onChange} />
    }
    return <RelationControl control={props.control} field={props.field} choices={props.choices} value={props.value} onChange={props.onChange} />
  }

  const handleCreated = (_row: RecordRow, id: string) => {
    if (props.field.relation?.kind === 'hasMany') {
      const cur = Array.isArray(props.value()) ? (props.value() as string[]) : []
      props.onChange([...cur, id])
    } else {
      props.onChange(id)
    }
    setCreating(false)
  }

  return (
    <>
      <div {...stylex.props(styles.fieldRow)}>
        <div {...stylex.props(styles.fieldRowMain)}>{relationControl()}</div>
        <Show when={target()}>
          <button
            type="button"
            title={`Create a new ${target()} record`}
            aria-label={`Create a new ${target()} record`}
            onClick={() => setCreating(true)}
            {...stylex.props(s.btnIcon)}
          >
            <PlusIcon size={14} />
          </button>
        </Show>
      </div>
      <Show when={creating() && target()}>
        <RelatedRecordCreate
          target={target()!}
          languages={props.languages}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      </Show>
    </>
  )
}