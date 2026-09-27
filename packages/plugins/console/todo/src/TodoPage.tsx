/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { pluginTokens, ps } from '@hamolus/plugin-console-contracts/styles.stylex.ts'
import type { PluginPageProps } from '@hamolus/plugin-console-contracts'

export type TodoPriority = 'low' | 'medium' | 'high'
export type TodoFilter = 'all' | 'active' | 'done'

export interface TodoItem {
  id: string
  text: string
  done: boolean
  priority: TodoPriority
  createdAt: string
  updatedAt: string
}

const PRIORITIES: TodoPriority[] = ['low', 'medium', 'high']
export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const KEY_PREFIX = 'item:'

function nowIso(): string {
  return new Date().toISOString()
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const styles = stylex.create({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 680,
  },
  toolbar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  addInput: {
    flex: '1 1 240px',
    minWidth: 0,
  },
  addSelect: {
    flex: '0 0 118px',
  },
  filters: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    padding: '0 12px',
    borderStyle: 'none',
    borderRadius: pluginTokens.radiusSm,
    fontSize: 12.5,
    fontWeight: 600,
    color: pluginTokens.textDim,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': {
      color: pluginTokens.text,
      backgroundColor: pluginTokens.surfaceRaised,
    },
  },
  filterActive: {
    color: pluginTokens.accent,
    backgroundColor: pluginTokens.accentSoft,
  },
  count: {
    fontFamily: pluginTokens.fontMono,
    fontSize: 11,
    opacity: 0.85,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    backgroundColor: pluginTokens.surface,
    borderRadius: pluginTokens.radius,
    boxShadow: `0 0 0 1px ${pluginTokens.border}`,
    transition: 'background-color 0.15s ease, opacity 0.15s ease',
  },
  itemDone: {
    opacity: 0.6,
  },
  toggle: {
    flexShrink: 0,
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: pluginTokens.borderStrong,
    borderRadius: pluginTokens.radiusSm,
    fontSize: 12,
    color: pluginTokens.accent,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
    ':hover': {
      borderColor: pluginTokens.accent,
    },
  },
  toggleOn: {
    color: pluginTokens.accent,
    backgroundColor: pluginTokens.accentBold,
    borderColor: pluginTokens.accent,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemText: {
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.45,
    color: pluginTokens.text,
    wordBreak: 'break-word',
  },
  itemMeta: {
    margin: 0,
    fontSize: 11.5,
    color: pluginTokens.textDim,
  },
  priority: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 18,
    padding: '0 7px',
    borderRadius: pluginTokens.radiusSm,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  priorityHigh: {
    color: pluginTokens.danger,
    backgroundColor: 'color-mix(in srgb, var(--danger) 14%, transparent)',
  },
  priorityMedium: {
    color: pluginTokens.accent,
    backgroundColor: pluginTokens.accentSoft,
  },
  priorityLow: {
    color: 'var(--ok)',
    backgroundColor: 'color-mix(in srgb, var(--ok) 14%, transparent)',
  },
  deleteBtn: {
    flexShrink: 0,
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'none',
    borderRadius: pluginTokens.radiusSm,
    fontSize: 14,
    color: pluginTokens.textDim,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': {
      color: pluginTokens.danger,
      backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
    },
  },
  empty: {
    padding: '26px 16px',
    textAlign: 'center',
    fontSize: 13,
    color: pluginTokens.textDim,
    backgroundColor: pluginTokens.surface,
    borderRadius: pluginTokens.radius,
    boxShadow: `0 0 0 1px ${pluginTokens.border}`,
  },
  error: {
    padding: '8px 12px',
    borderRadius: pluginTokens.radiusSm,
    fontSize: 12.5,
    color: pluginTokens.danger,
    backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
  },
})

export function TodoPage(props: PluginPageProps) {
  const [items, setItems] = createSignal<TodoItem[]>([])
  const [loaded, setLoaded] = createSignal(false)
  const [text, setText] = createSignal('')
  const [priority, setPriority] = createSignal<TodoPriority>('medium')
  const [filter, setFilter] = createSignal<TodoFilter>('all')
  const [error, setError] = createSignal<string | null>(null)

  const canWrite = () => props.permissions.canWrite

  onMount(async () => {
    try {
      const entries = await props.kv.list()
      const parsed: TodoItem[] = []
      for (const e of entries) {
        if (!e.key.startsWith(KEY_PREFIX)) continue
        const v = e.value as Partial<TodoItem>
        if (v && typeof v.id === 'string' && typeof v.text === 'string') {
          parsed.push({
            id: v.id,
            text: v.text,
            done: v.done === true,
            priority: PRIORITIES.includes(v.priority as TodoPriority)
              ? (v.priority as TodoPriority)
              : 'medium',
            createdAt: typeof v.createdAt === 'string' ? v.createdAt : '',
            updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
          })
        }
      }
      parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      setItems(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the todo list')
    } finally {
      setLoaded(true)
    }
  })

  const counts = createMemo(() => {
    const all = items()
    return {
      all: all.length,
      active: all.filter((i) => !i.done).length,
      done: all.filter((i) => i.done).length,
    }
  })

  const visible = createMemo(() => {
    const f = filter()
    const all = items()
    if (f === 'active') return all.filter((i) => !i.done)
    if (f === 'done') return all.filter((i) => i.done)
    return all
  })

  async function persist(item: TodoItem) {
    await props.kv.set(KEY_PREFIX + item.id, item)
    setItems((prev) => {
      const next = prev.slice()
      const idx = next.findIndex((i) => i.id === item.id)
      if (idx >= 0) next[idx] = item
      return next
    })
  }

  async function add() {
    const t = text().trim()
    if (!t || !canWrite()) return
    const now = nowIso()
    setText('')
    setError(null)
    try {
      await persist({ id: uid(), text: t, done: false, priority: priority(), createdAt: now, updatedAt: now })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the item')
    }
  }

  async function toggle(item: TodoItem) {
    if (!canWrite()) return
    setError(null)
    try {
      await persist({ ...item, done: !item.done, updatedAt: nowIso() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the item')
    }
  }

  async function remove(item: TodoItem) {
    if (!canWrite()) return
    setError(null)
    try {
      await props.kv.del(KEY_PREFIX + item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the item')
    }
  }

  async function clearDone() {
    if (!canWrite()) return
    const done = items().filter((i) => i.done)
    setError(null)
    try {
      for (const item of done) await props.kv.del(KEY_PREFIX + item.id)
      setItems((prev) => prev.filter((i) => !i.done))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear completed items')
    }
  }

  return (
    <div {...stylex.props(ps.page)}>
      <div {...stylex.props(ps.header)}>
        <div>
          <h1 {...stylex.props(ps.title)}>{props.plugin.name}</h1>
          <p {...stylex.props(ps.subtitle)}>{props.plugin.description}</p>
        </div>
        <Show when={counts().done > 0 && canWrite()}>
          <button type="button" {...stylex.props(ps.btnGhost)} onClick={clearDone}>
            Clear completed
          </button>
        </Show>
      </div>

      <Show when={!canWrite()}>
        <div {...stylex.props(ps.dim)}>
          Read-only — your role cannot modify plugin data.
        </div>
      </Show>

      <Show when={error()}>
        <div {...stylex.props(styles.error)}>{error()}</div>
      </Show>

      <Show when={!loaded()}>
        <div {...stylex.props(styles.empty)}>Loading…</div>
      </Show>

      <Show when={loaded()}>
        <div {...stylex.props(styles.wrap)}>
          <Show when={canWrite()}>
            <div {...stylex.props(styles.toolbar)}>
              <input
                {...stylex.props(styles.addInput, ps.input)}
                placeholder="What needs to be done?"
                value={text()}
                onInput={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add()
                }}
              />
              <select
                {...stylex.props(styles.addSelect, ps.select)}
                value={priority()}
                onChange={(e) => setPriority(e.currentTarget.value as TodoPriority)}
              >
                <For each={PRIORITIES}>
                  {(p) => <option value={p}>{PRIORITY_LABELS[p]}</option>}
                </For>
              </select>
              <button type="button" {...stylex.props(ps.btn)} onClick={add} disabled={!text().trim()}>
                Add
              </button>
            </div>
          </Show>

          <div {...stylex.props(styles.filters)}>
            {(['all', 'active', 'done'] as TodoFilter[]).map((f) => (
              <button
                type="button"
                {...stylex.props(styles.filterBtn, filter() === f && styles.filterActive)}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Done'}
                <span {...stylex.props(styles.count)}>{counts()[f]}</span>
              </button>
            ))}
          </div>

          <Show when={visible().length === 0}>
            <div {...stylex.props(styles.empty)}>
              {filter() === 'all' ? 'No items yet — add your first one above.' : 'Nothing here.'}
            </div>
          </Show>

          <div {...stylex.props(styles.list)}>
            <For each={visible()}>
              {(item) => (
                <div {...stylex.props(styles.item, item.done && styles.itemDone)}>
                  <button
                    type="button"
                    title={item.done ? 'Mark as active' : 'Mark as done'}
                    aria-label={item.done ? 'Mark as active' : 'Mark as done'}
                    {...stylex.props(styles.toggle, item.done && styles.toggleOn)}
                    onClick={() => toggle(item)}
                    disabled={!canWrite()}
                  >
                    {item.done ? '✓' : ''}
                  </button>
                  <div {...stylex.props(styles.textWrap)}>
                    <p {...stylex.props(styles.itemText)}>{item.text}</p>
                    <p {...stylex.props(styles.itemMeta)}>
                      Created {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    {...stylex.props(
                      styles.priority,
                      item.priority === 'high' && styles.priorityHigh,
                      item.priority === 'medium' && styles.priorityMedium,
                      item.priority === 'low' && styles.priorityLow,
                    )}
                  >
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                  <Show when={canWrite()}>
                    <button
                      type="button"
                      title="Delete item"
                      aria-label="Delete item"
                      {...stylex.props(styles.deleteBtn)}
                      onClick={() => remove(item)}
                    >
                      ✕
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}