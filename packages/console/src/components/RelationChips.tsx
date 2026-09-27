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
import { s, tokens } from '../theme.stylex'
import { useRelationContext } from '../lib/relations'
import { XIcon } from './Icons'

const styles = stylex.create({
  wrap: {
    position: 'relative',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '6px 8px',
    minHeight: 38,
    backgroundColor: tokens.surfaceRaised,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowInput}`,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus-within': {
      boxShadow: `0 0 0 1px ${tokens.accentSoft}, ${tokens.shadowInputFocus}`,
    },
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
    color: tokens.accent,
    backgroundColor: tokens.accentBold,
    boxShadow: `inset 0 0 0 1px ${tokens.accentBold}`,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
  },
  chipRemove: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.accent,
    cursor: 'pointer',
    borderRadius: '50%',
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.borderStrong },
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
  option: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 10px',
    fontSize: 13,
    color: tokens.text,
    cursor: 'pointer',
    transition: 'background-color 0.12s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  optionSelected: {
    color: tokens.accent,
    fontWeight: 600,
  },
  empty: {
    padding: '10px 10px',
    fontSize: 12,
    color: tokens.textDim,
  },
  input: {
    flex: 1,
    minWidth: 80,
    borderStyle: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: 13,
    color: tokens.text,
    padding: '2px 0',
  },
  status: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
  },
  statusError: {
    fontSize: 11,
    color: tokens.danger,
    marginTop: 2,
  },
  statusOk: {
    fontSize: 11,
    color: tokens.ok,
    marginTop: 2,
  },
})

export function RelationChips(props: {
  field: FieldDefinition
  value: () => unknown
  onChange: (value: unknown) => void
}) {
  const { field, onChange } = props
  const target = () => field.relation?.collection
  const q = useRelationContext(target)
  const data = () => q.data
  const selectedIds = () => {
    const v = props.value()
    return Array.isArray(v) ? (v as string[]) : []
  }
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal('')

  const optionMap = () => {
    const m = new Map<string, string>()
    for (const opt of data()?.options ?? []) m.set(opt.value, opt.label)
    return m
  }

  const filteredOptions = () => {
    const q = query().toLowerCase()
    const sel = new Set(selectedIds())
    return (data()?.options ?? []).filter(
      (o) => !sel.has(o.value) && (!q || o.label.toLowerCase().includes(q) || o.value.includes(q)),
    )
  }

  const addValue = (id: string) => {
    const next = [...selectedIds(), id]
    onChange(next)
    setQuery('')
  }

  const removeValue = (id: string) => {
    onChange(selectedIds().filter((v) => v !== id))
  }

  return (
    <div {...stylex.props(styles.wrap)}>
      <div {...stylex.props(styles.chips)} onClick={() => setOpen(true)}>
        <For each={selectedIds()}>
          {(id) => (
            <span {...stylex.props(styles.chip)}>
              <span>{optionMap().get(id) ?? id}</span>
              <button
                type="button"
                aria-label={`Remove ${optionMap().get(id) ?? id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  removeValue(id)
                }}
                {...stylex.props(styles.chipRemove)}
              >
                <XIcon size={10} />
              </button>
            </span>
          )}
        </For>
        <input
          type="text"
          placeholder={selectedIds().length === 0 ? 'Search…' : ''}
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          {...stylex.props(styles.input)}
        />
      </div>
      <Show when={open() && filteredOptions().length > 0}>
        <div {...stylex.props(styles.dropdown)}>
          <For each={filteredOptions()}>
            {(opt) => (
              <div
                {...stylex.props(styles.option)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  addValue(opt.value)
                }}
              >
                {opt.label}
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={q.isLoading}>
        <div {...stylex.props(styles.status)}>Loading references…</div>
      </Show>
      <Show when={q.isError}>
        <div {...stylex.props(styles.statusError)}>
          Failed to load references from '{target()}'.
        </div>
      </Show>
      <Show when={!q.isError && data() && !data()!.def}>
        <div {...stylex.props(styles.statusError)}>
          Target collection '{target()}' is not registered.
        </div>
      </Show>
      <Show when={!q.isError && data() && data()!.def && data()!.rows.length === 0}>
        <div {...stylex.props(styles.statusOk)}>
          No records in '{target()}' yet — create one first.
        </div>
      </Show>
    </div>
  )
}
