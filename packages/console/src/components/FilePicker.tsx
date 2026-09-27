/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createQuery } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { FileObject } from '@hamolus/types'
import { api, type FileKind } from '../lib/api'
import { fileKindMeta, formatBytes } from '../lib/files'
import { s, tokens } from '../theme.stylex'
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, XIcon } from './Icons'

const PAGE_SIZE = 20

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
    maxWidth: 720,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadow,
    borderRadius: tokens.radius,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  search: {
    flex: 1,
    padding: '7px 12px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': { boxShadow: tokens.shadowInputFocus },
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 360,
    overflowY: 'auto',
    minHeight: 80,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '7px 10px',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '34px',
    flexShrink: 0,
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderRadius: tokens.radiusSm,
  },
  info: {
    minWidth: 0,
    flex: 1,
  },
  name: {
    fontSize: 13,
    color: tokens.text,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  meta: {
    fontSize: 11,
    color: tokens.textDim,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  count: {
    fontSize: 12,
    color: tokens.textDim,
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pageLabel: {
    fontSize: 12,
    color: tokens.textDim,
    minWidth: 56,
    textAlign: 'center',
  },
  empty: {
    padding: 28,
    textAlign: 'center',
    color: tokens.textDim,
    fontSize: 13,
  },
})

export function FilePicker(props: {
  kind: FileKind
  onClose: () => void
  onPick: (item: FileObject) => void
  title?: string
}) {
  const [search, setSearch] = createSignal('')
  const [page, setPage] = createSignal(1)
  const query = createQuery(() => ({
    queryKey: ['files-picker', props.kind, page(), search()] as const,
    queryFn: () =>
      api.listFiles(props.kind, { page: page(), pageSize: PAGE_SIZE, search: search() || undefined }),
  }))

  const rows = () => query.data?.data ?? []
  const meta = () => query.data?.meta
  const totalPages = () => Math.max(1, meta()?.totalPages ?? 1)
  const label = fileKindMeta(props.kind).noun

  return (
    <div {...stylex.props(styles.overlay)} onClick={props.onClose}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <h2 {...stylex.props(s.heading)}>{props.title ?? `Choose ${label}`}</h2>
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

        <div {...stylex.props(styles.toolbar)}>
          <input
            type="text"
            placeholder={`Search ${fileKindMeta(props.kind).plural}…`}
            value={search()}
            onInput={(e) => {
              setSearch(e.currentTarget.value)
              setPage(1)
            }}
            {...stylex.props(styles.search)}
          />
        </div>

        <Show when={query.isLoading}>
          <div {...stylex.props(styles.empty)}>Loading {label}s…</div>
        </Show>
        <Show when={query.isError}>
          <div {...stylex.props(styles.empty)}>Failed to load {label}s.</div>
        </Show>

        <Show when={!query.isLoading && !query.isError && rows().length === 0}>
          <div {...stylex.props(styles.empty)}>
            {search() ? `No ${label}s match the search.` : `No ${label}s yet — upload some first.`}
          </div>
        </Show>

        <Show when={!query.isLoading && !query.isError && rows().length > 0}>
          <div {...stylex.props(styles.list)}>
            <For each={rows()}>
              {(item) => (
                <button type="button" onClick={() => props.onPick(item)} {...stylex.props(styles.row)}>
                  <span {...stylex.props(styles.tile)}>
                    <FileTextIcon size={16} />
                  </span>
                  <span {...stylex.props(styles.info)}>
                    <span {...stylex.props(styles.name)}>{item.name}</span>
                    <span {...stylex.props(styles.meta)}>
                      {item.mime}{item.size ? ` · ${formatBytes(item.size)}` : ''}
                    </span>
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div {...stylex.props(styles.footer)}>
          {(() => {
            const m = meta()
            return (
              <span {...stylex.props(styles.count)}>
                {m ? `${m.total} ${m.total === 1 ? label : fileKindMeta(props.kind).plural}` : ''}
              </span>
            )
          })()}
          <div {...stylex.props(styles.pager)}>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page() <= 1 || totalPages() <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              {...stylex.props(s.btnIcon, s.btnIconSm)}
            >
              <ChevronLeftIcon size={14} />
            </button>
            <span {...stylex.props(styles.pageLabel)}>
              {page()} / {totalPages()}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={page() >= totalPages()}
              onClick={() => setPage((p) => p + 1)}
              {...stylex.props(s.btnIcon, s.btnIconSm)}
            >
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}