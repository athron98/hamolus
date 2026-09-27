/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, For, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { pluginTokens, ps } from '@hamolus/plugin-console-contracts/styles.stylex.ts'
import type { PluginPageProps } from '@hamolus/plugin-console-contracts'

export interface KanbanCard {
  id: string
  title: string
  description?: string
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
}

const BOARD_KEY = 'board'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const styles = stylex.create({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  toolbar: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  colInput: {
    flex: '1 1 200px',
    minWidth: 0,
  },
  board: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    overflowX: 'auto',
    paddingBottom: 8,
  },
  column: {
    flex: '0 0 264px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    backgroundColor: pluginTokens.surface,
    borderRadius: pluginTokens.radius,
    boxShadow: `0 0 0 1px ${pluginTokens.border}`,
    transition: 'box-shadow 0.15s ease, background-color 0.15s ease',
  },
  columnDragOver: {
    boxShadow: `0 0 0 2px ${pluginTokens.accent}, ${pluginTokens.shadowSm}`,
    backgroundColor: pluginTokens.accentSoft,
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px 0',
  },
  colTitle: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: pluginTokens.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  colCount: {
    fontFamily: pluginTokens.fontMono,
    fontSize: 11,
    color: pluginTokens.textDim,
  },
  colCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 10px 4px',
    minHeight: 60,
  },
  card: {
    padding: '10px 12px',
    backgroundColor: pluginTokens.surfaceRaised,
    borderRadius: pluginTokens.radiusSm,
    boxShadow: `0 0 0 1px ${pluginTokens.border}`,
    cursor: 'grab',
    userSelect: 'none',
    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
    ':active': {
      cursor: 'grabbing',
    },
  },
  cardDragging: {
    opacity: 0.45,
    boxShadow: `0 0 0 1px ${pluginTokens.accent}, ${pluginTokens.shadowSm}`,
  },
  cardTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: pluginTokens.text,
    wordBreak: 'break-word',
  },
  cardDesc: {
    margin: '4px 0 0',
    fontSize: 12,
    color: pluginTokens.textDim,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  cardDelete: {
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'none',
    borderRadius: pluginTokens.radiusSm,
    fontSize: 13,
    color: pluginTokens.textDim,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':hover': {
      color: pluginTokens.danger,
      backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
    },
  },
  cardInputRow: {
    display: 'flex',
    gap: 6,
    padding: '2px 10px 10px',
  },
  cardInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    borderStyle: 'none',
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: pluginTokens.borderStrong,
    borderRadius: 0,
    padding: '0 4px',
    fontSize: 12.5,
    color: pluginTokens.text,
    backgroundColor: 'transparent',
    ':focus': {
      outline: 'none',
      borderBottomColor: pluginTokens.accent,
    },
  },
  columnDanger: {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'none',
    borderRadius: pluginTokens.radiusSm,
    fontSize: 13,
    color: pluginTokens.textDim,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':hover': {
      color: pluginTokens.danger,
      backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
    },
  },
  empty: {
    padding: '22px 16px',
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

const emptyBoard: KanbanBoard = { columns: [] }

export function KanbanPage(props: PluginPageProps) {
  const [board, setBoard] = createSignal<KanbanBoard>(emptyBoard)
  const [loaded, setLoaded] = createSignal(false)
  const [colTitle, setColTitle] = createSignal('')
  const [cardDrafts, setCardDrafts] = createSignal<Record<string, string>>({})
  const [dragOverId, setDragOverId] = createSignal<string | null>(null)
  const [draggingId, setDraggingId] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)

  const canWrite = () => props.permissions.canWrite

  onMount(async () => {
    try {
      const stored = await props.kv.get<KanbanBoard>(BOARD_KEY)
      setBoard(stored && Array.isArray(stored.columns) ? stored : emptyBoard)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the board')
    } finally {
      setLoaded(true)
    }
  })

  async function persist(next: KanbanBoard) {
    setBoard(next)
    await props.kv.set(BOARD_KEY, next)
  }

  async function addColumn() {
    const title = colTitle().trim()
    if (!title || !canWrite()) return
    setColTitle('')
    setError(null)
    try {
      const next = board()
      await persist({
        ...next,
        columns: [...next.columns, { id: uid(), title, cards: [] }],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the column')
    }
  }

  function draft(colId: string): string {
    return cardDrafts()[colId] ?? ''
  }

  function setDraft(colId: string, value: string) {
    setCardDrafts((prev) => ({ ...prev, [colId]: value }))
  }

  async function addCard(colId: string) {
    const title = draft(colId).trim()
    if (!title || !canWrite()) return
    setError(null)
    try {
      const next = board()
      await persist({
        ...next,
        columns: next.columns.map((col) =>
          col.id === colId
            ? { ...col, cards: [...col.cards, { id: uid(), title }] }
            : col,
        ),
      })
      setDraft(colId, '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the card')
    }
  }

  async function deleteCard(colId: string, cardId: string) {
    if (!canWrite()) return
    setError(null)
    try {
      const next = board()
      await persist({
        ...next,
        columns: next.columns.map((col) =>
          col.id === colId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col,
        ),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the card')
    }
  }

  async function deleteColumn(colId: string) {
    if (!canWrite()) return
    setError(null)
    try {
      const next = board()
      await persist({ ...next, columns: next.columns.filter((col) => col.id !== colId) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the column')
    }
  }

  function onDragStart(e: DragEvent, card: KanbanCard) {
    setDraggingId(card.id)
    e.dataTransfer?.setData('text/plain', JSON.stringify({ cardId: card.id }))
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  async function onDrop(e: DragEvent, colId: string) {
    e.preventDefault()
    setDragOverId(null)
    setDraggingId(null)
    if (!canWrite()) return
    const raw = e.dataTransfer?.getData('text/plain')
    if (!raw) return
    try {
      const { cardId } = JSON.parse(raw) as { cardId?: string }
      if (!cardId) return
      const next = board()
      let moved: KanbanCard | null = null
      const from = next.columns.find((col) => col.cards.some((c) => c.id === cardId))
      if (!from) return
      // No-op when dropped on its own column.
      if (from.id === colId) return
      moved = from.cards.find((c) => c.id === cardId) ?? null
      if (!moved) return
      await persist({
        ...next,
        columns: next.columns.map((col) => {
          if (col.id === from.id) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
          if (col.id === colId) return { ...col, cards: [...col.cards, moved!] }
          return col
        }),
      })
    } catch {
      // Malformed payload — ignore.
    }
  }

  const totalCards = () => board().columns.reduce((n, col) => n + col.cards.length, 0)

  return (
    <div {...stylex.props(ps.page)}>
      <div {...stylex.props(ps.header)}>
        <div>
          <h1 {...stylex.props(ps.title)}>{props.plugin.name}</h1>
          <p {...stylex.props(ps.subtitle)}>{props.plugin.description}</p>
        </div>
        <span {...stylex.props(ps.mono)}>
          {board().columns.length} col · {totalCards()} cards
        </span>
      </div>

      <Show when={!canWrite()}>
        <div {...stylex.props(ps.dim)}>Read-only — your role cannot modify plugin data.</div>
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
                {...stylex.props(styles.colInput, ps.input)}
                placeholder="Column name…"
                value={colTitle()}
                onInput={(e) => setColTitle(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addColumn()
                }}
              />
              <button type="button" {...stylex.props(ps.btn)} onClick={addColumn} disabled={!colTitle().trim()}>
                Add column
              </button>
            </div>
          </Show>

          <Show when={board().columns.length === 0}>
            <div {...stylex.props(styles.empty)}>No columns yet — add your first one above.</div>
          </Show>

          <div {...stylex.props(styles.board)}>
            <For each={board().columns}>
              {(col) => (
                <div
                  {...stylex.props(styles.column, dragOverId() === col.id && styles.columnDragOver)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverId(col.id)
                  }}
                  onDragLeave={() => setDragOverId((cur) => (cur === col.id ? null : cur))}
                  onDrop={(e) => onDrop(e, col.id)}
                >
                  <div {...stylex.props(styles.colHeader)}>
                    <p {...stylex.props(styles.colTitle)} title={col.title}>
                      {col.title}
                    </p>
                    <span {...stylex.props(styles.colCount)}>{col.cards.length}</span>
                    <Show when={canWrite()}>
                      <button
                        type="button"
                        title="Delete column"
                        aria-label={`Delete column ${col.title}`}
                        {...stylex.props(styles.columnDanger)}
                        onClick={() => deleteColumn(col.id)}
                      >
                        ✕
                      </button>
                    </Show>
                  </div>

                  <div {...stylex.props(styles.colCards)}>
                    <For each={col.cards}>
                      {(card) => (
                        <div
                          {...stylex.props(styles.card, draggingId() === card.id && styles.cardDragging)}
                          title={card.title}
                          draggable={canWrite()}
                          onDragStart={(e) => onDragStart(e, card)}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setDragOverId(null)
                          }}
                        >
                          <p {...stylex.props(styles.cardTitle)}>{card.title}</p>
                          <Show when={card.description}>
                            <p {...stylex.props(styles.cardDesc)}>{card.description}</p>
                          </Show>
                          <Show when={canWrite()}>
                            <div {...stylex.props(styles.cardActions)}>
                              <button
                                type="button"
                                title="Delete card"
                                aria-label={`Delete card ${card.title}`}
                                {...stylex.props(styles.cardDelete)}
                                onClick={() => deleteCard(col.id, card.id)}
                              >
                                ✕
                              </button>
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>

                  <Show when={canWrite()}>
                    <div {...stylex.props(styles.cardInputRow)}>
                      <input
                        {...stylex.props(styles.cardInput)}
                        placeholder="Add a card…"
                        value={draft(col.id)}
                        onInput={(e) => setDraft(col.id, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addCard(col.id)
                        }}
                      />
                      <button
                        type="button"
                        title="Add card"
                        aria-label="Add card"
                        {...stylex.props(ps.btnIcon)}
                        onClick={() => addCard(col.id)}
                        disabled={!draft(col.id).trim()}
                      >
                        +
                      </button>
                    </div>
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