/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { TaxonomyType, TaxonomyValue } from '@hamolus/types'
import { api } from '../lib/api'
import { logActivity } from '../lib/activity'
import { s, tokens } from '../theme.stylex'
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from './Icons'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    overflowY: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadow,
    borderRadius: tokens.radius,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowCount: {
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
  },
  renameInput: {
    flex: 1,
    minWidth: 0,
    padding: '4px 8px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadowInputFocus,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.textDim,
    cursor: 'pointer',
    borderRadius: tokens.radiusSm,
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text, backgroundColor: tokens.surfaceRaised },
  },
  dangerBtn: {
    ':hover': { color: tokens.danger, backgroundColor: tokens.dangerSoft },
  },
  empty: { fontSize: 12, color: tokens.textDim },
  error: { color: tokens.danger, fontSize: 12 },
})

const TYPES: { type: TaxonomyType; label: string }[] = [
  { type: 'group', label: 'Groups' },
  { type: 'category', label: 'Categories' },
  { type: 'tag', label: 'Tags' },
]

const TYPE_OF: Record<string, string> = {
  group: 'Group',
  category: 'Category',
  tag: 'Tag',
}

export function TaxonomyPanel(props: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const detail = createQuery(() => ({
    queryKey: ['media-taxonomy-detail'],
    queryFn: () => api.getMediaTaxonomyDetail().then((r) => r.data),
  }))

  const [renaming, setRenaming] = createSignal<{ type: TaxonomyType; from: string } | null>(null)
  const [draft, setDraft] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)

  const values = (type: TaxonomyType): TaxonomyValue[] =>
    (detail.data && (type === 'group' ? detail.data.groups : type === 'category' ? detail.data.categories : detail.data.tags)) ??
    []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['media'] })
    queryClient.invalidateQueries({ queryKey: ['media-taxonomy'] })
    queryClient.invalidateQueries({ queryKey: ['media-taxonomy-detail'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  const run = createMutation(() => ({
    mutationFn: (a: { type: TaxonomyType; from: string; to?: string }) =>
      api.applyTaxonomyChange(a),
    onSuccess: (_data, a) => {
      logActivity(
        'media.update',
        a.to === undefined
          ? `Deleted ${TYPE_OF[a.type].toLowerCase()} '${a.from}' across media`
          : `Renamed ${TYPE_OF[a.type].toLowerCase()} '${a.from}' → '${a.to}' across media`,
      )
      setRenaming(null)
      setDraft('')
      refresh()
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Operation failed'),
  }))

  const startRename = (type: TaxonomyType, from: string) => {
    setRenaming({ type, from })
    setDraft(from)
  }

  const confirmRename = () => {
    const r = renaming()
    if (!r) return
    const to = draft().trim()
    if (!to || to === r.from) {
      setRenaming(null)
      setDraft('')
      return
    }
    run.mutate({ type: r.type, from: r.from, to })
  }

  const removeValue = (type: TaxonomyType, from: string) => {
    if (!confirm(`Remove '${from}' from every image? The value itself is deleted.`)) return
    setError(null)
    run.mutate({ type, from })
  }

  return (
    <div {...stylex.props(styles.overlay)} onClick={props.onClose}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <div>
            <h2 {...stylex.props(s.heading)}>Media taxonomy</h2>
            <p {...stylex.props(s.subheading)}>
              Rename or delete groups, categories and tags across every image.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onClose}
            {...stylex.props(s.btnIcon)}
          >
            <XIcon size={15} />
          </button>
        </div>

        <Show when={error()}>
          <p {...stylex.props(styles.error)}>{error()}</p>
        </Show>

        <Show
          when={!detail.isLoading && detail.data}
          fallback={<p {...stylex.props(s.muted)}>Loading taxonomy…</p>}
        >
          <For each={TYPES}>
            {(t) => (
              <div {...stylex.props(styles.section)}>
                <div {...stylex.props(styles.sectionTitle)}>
                  {t.label}
                  <span {...stylex.props(styles.rowCount)}>{values(t.type).length}</span>
                </div>
                <Show
                  when={values(t.type).length > 0}
                  fallback={<p {...stylex.props(styles.empty)}>No {t.label.toLowerCase()} yet.</p>}
                >
                  <For each={values(t.type)}>
                    {(v) => (
                      <div {...stylex.props(styles.row)}>
                        <Show
                          when={renaming()?.type === t.type && renaming()?.from === v.value}
                          fallback={
                            <>
                              <span title={v.value} {...stylex.props(styles.rowName)}>
                                {v.value}
                              </span>
                              <span {...stylex.props(styles.rowCount)}>
                                {v.count} {v.count === 1 ? 'asset' : 'assets'}
                              </span>
                              <button
                                type="button"
                                title={`Rename '${v.value}'`}
                                aria-label={`Rename ${TYPE_OF[t.type].toLowerCase()} ${v.value}`}
                                onClick={() => startRename(t.type, v.value)}
                                {...stylex.props(styles.actionBtn)}
                              >
                                <PencilIcon size={13} />
                              </button>
                              <button
                                type="button"
                                title={`Delete '${v.value}'`}
                                aria-label={`Delete ${TYPE_OF[t.type].toLowerCase()} ${v.value}`}
                                onClick={() => removeValue(t.type, v.value)}
                                {...stylex.props(styles.actionBtn, styles.dangerBtn)}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </>
                          }
                        >
                          <input
                            type="text"
                            value={draft()}
                            autofocus={false}
                            onInput={(e) => setDraft(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmRename()
                              if (e.key === 'Escape') {
                                setRenaming(null)
                                setDraft('')
                              }
                            }}
                            {...stylex.props(styles.renameInput)}
                          />
                          <button
                            type="button"
                            title="Confirm rename"
                            aria-label="Confirm rename"
                            onClick={confirmRename}
                            {...stylex.props(styles.actionBtn)}
                          >
                            <CheckIcon size={13} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            aria-label="Cancel rename"
                            onClick={() => {
                              setRenaming(null)
                              setDraft('')
                            }}
                            {...stylex.props(styles.actionBtn)}
                          >
                            <XIcon size={13} />
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}