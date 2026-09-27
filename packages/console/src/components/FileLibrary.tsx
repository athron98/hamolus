/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { FileKind, FileObject, FileRefValue } from '@hamolus/types'
import { api } from '../lib/api'
import { fileKindMeta, formatBytes } from '../lib/files'
import { resolveMediaUrl } from '../lib/media'
import { logActivity } from '../lib/activity'
import { s, tokens } from '../theme.stylex'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PencilIcon,
  TrashIcon,
  UploadIcon,
} from './Icons'
import { FileUploadModal } from './FileUploadModal'
import { FileEditor } from './FileEditor'
import { FilePicker } from './FilePicker'

const styles = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  headerInfo: {
    minWidth: 0,
  },
  headerBlurb: {
    fontSize: 13,
    color: tokens.textDim,
    maxWidth: 480,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  search: {
    flex: 1,
    minWidth: 180,
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
  select: {
    padding: '7px 10px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    maxWidth: 180,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
    boxShadow: tokens.shadowCard,
  },
  tileWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusSm,
    overflow: 'hidden',
  },
  tileImg: {
    width: '100%',
    height: 110,
    objectFit: 'cover',
    display: 'block',
  },
  tileText: {
    color: tokens.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    minWidth: 0,
  },
  cardName: {
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  cardSub: {
    fontSize: 11,
    color: tokens.textDim,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: tokens.textDim,
    fontSize: 13,
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
    minWidth: 64,
    textAlign: 'center',
  },
})

export function FileLibrary(props: { kind: FileKind }) {
  const kind = props.kind
  const meta = fileKindMeta(kind)
  const qc = useQueryClient()

  const [page, setPage] = createSignal(1)
  const [search, setSearch] = createSignal('')
  const [activeGroup, setActiveGroup] = createSignal('')
  const [activeCat, setActiveCat] = createSignal('')
  const [activeTag, setActiveTag] = createSignal('')
  const [uploadOpen, setUploadOpen] = createSignal(false)
  const [editing, setEditing] = createSignal<FileObject | null>(null)
  const [picking, setPicking] = createSignal(false)
  const [copied, setCopied] = createSignal<string | null>(null)

  const taxonomy = createQuery(() => ({
    queryKey: ['files-taxonomy', kind] as const,
    queryFn: () => api.getFileTaxonomy(kind).then((r) => r.data),
  }))

  const files = createQuery(() => ({
    queryKey: ['files', kind, page(), search(), activeGroup(), activeCat(), activeTag()] as const,
    queryFn: () =>
      api.listFiles(kind, {
        page: page(),
        pageSize: 24,
        search: search() || undefined,
        group: activeGroup() || undefined,
        category: activeCat() || undefined,
        tag: activeTag() || undefined,
      }),
  }))

  const totalPages = () => files.data?.meta.totalPages ?? 1

  const copyUrl = async (u: string) => {
    try {
      await navigator.clipboard.writeText(u)
      setCopied(u)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  const openInTab = (item: FileObject) => {
    window.open(resolveMediaUrl(item.url), '_blank', 'noreferrer')
    setCopied(null)
  }

  const removeFile = async (item: FileObject) => {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await api.deleteFile(kind, item.id)
      logActivity(`${kind}.delete`, `${meta.noun} ${item.name}`)
      qc.invalidateQueries({ queryKey: ['files', kind] })
      qc.invalidateQueries({ queryKey: ['files-taxonomy', kind] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const onPicked = (ref: FileRefValue) => {
    setPicking(false)
    setCopied(ref.url)
  }

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerInfo)}>
          <h1 {...stylex.props(s.heading)}>{meta.title}</h1>
          <p {...stylex.props(styles.headerBlurb)}>{meta.sub}</p>
        </div>
        <div {...stylex.props(styles.actions)}>
          <button type="button" onClick={() => setPicking(true)} {...stylex.props(s.btnGhost)}>
            <FileTextIcon size={14} />
            <span>Pick ref</span>
          </button>
          <button type="button" onClick={() => setUploadOpen(true)} {...stylex.props(s.btn)}>
            <UploadIcon size={14} />
            <span>Upload {meta.noun}</span>
          </button>
        </div>
      </div>

      <div {...stylex.props(styles.toolbar)}>
        <input
          type="text"
          placeholder={`Search ${meta.noun}s…`}
          value={search()}
          onInput={(e) => {
            setSearch(e.currentTarget.value)
            setPage(1)
          }}
          {...stylex.props(styles.search)}
        />
        <Show when={taxonomy.data}>
          <select
            value={activeGroup()}
            onChange={(e) => {
              setActiveGroup(e.currentTarget.value)
              setPage(1)
            }}
            {...stylex.props(styles.select)}
          >
            <option value="">All groups</option>
            <For each={taxonomy.data!.groups}>{(g) => <option value={g}>{g}</option>}</For>
          </select>
          <select
            value={activeCat()}
            onChange={(e) => {
              setActiveCat(e.currentTarget.value)
              setPage(1)
            }}
            {...stylex.props(styles.select)}
          >
            <option value="">All categories</option>
            <For each={taxonomy.data!.categories}>{(c) => <option value={c}>{c}</option>}</For>
          </select>
          <select
            value={activeTag()}
            onChange={(e) => {
              setActiveTag(e.currentTarget.value)
              setPage(1)
            }}
            {...stylex.props(styles.select)}
          >
            <option value="">All tags</option>
            <For each={taxonomy.data!.tags}>{(c) => <option value={c}>{c}</option>}</For>
          </select>
        </Show>
      </div>

      <Show when={files.isLoading}>
        <div {...stylex.props(styles.empty)}>Loading {meta.noun}s…</div>
      </Show>
      <Show when={files.isError}>
        <div {...stylex.props(styles.empty)}>Failed to load {meta.noun}s.</div>
      </Show>

      <Show when={!files.isLoading && !files.isError && (files.data?.data ?? []).length === 0}>
        <div {...stylex.props(styles.empty)}>
          {search() ? `No ${meta.noun}s match the search.` : `No ${meta.noun}s yet — upload some first.`}
        </div>
      </Show>

      <div {...stylex.props(styles.grid)}>
        <For each={files.data?.data ?? []}>
          {(item) => (
            <div {...stylex.props(styles.card)}>
              <div {...stylex.props(styles.tileWrap)}>
                <Show
                  when={item.mime.startsWith('image/')}
                  fallback={
                    <div {...stylex.props(styles.tileText)}>
                      <FileTextIcon size={32} />
                    </div>
                  }
                >
                  <img src={resolveMediaUrl(item.url)} alt={item.name} loading="lazy" {...stylex.props(styles.tileImg)} />
                </Show>
              </div>
              <div {...stylex.props(styles.cardInfo)}>
                <div {...stylex.props(styles.cardName)} title={item.name}>
                  {item.name}
                </div>
                <div {...stylex.props(styles.cardSub)}>
                  {item.mime} · {formatBytes(item.size)} {item.ext ? `· .${item.ext}` : ''}
                </div>
              </div>
              <div {...stylex.props(styles.actions)}>
                <button type="button" title="Edit" aria-label="Edit" onClick={() => setEditing(item)} {...stylex.props(s.btnIcon)}>
                  <PencilIcon size={14} />
                </button>
                <button
                  type="button"
                  title={copied() === item.id ? 'Copied!' : 'Copy URL'}
                  aria-label="Copy URL"
                  onClick={() => copyUrl(resolveMediaUrl(item.url))}
                  {...stylex.props(s.btnIcon)}
                >
                  <CopyIcon size={14} />
                </button>
                <button type="button" title="Open link" aria-label="Open link" onClick={() => openInTab(item)} {...stylex.props(s.btnIcon)}>
                  <ExternalLinkIcon size={14} />
                </button>
                <button type="button" title="Delete" aria-label="Delete" onClick={() => removeFile(item)} {...stylex.props(s.btnIcon, s.btnIconDanger)}>
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          )}
        </For>
      </div>

      <div {...stylex.props(styles.footer)}>
        <span {...stylex.props(styles.count)}>
          {files.data?.meta.total ?? 0} {meta.noun}
          {(files.data?.meta.total ?? 0) === 1 ? '' : 's'}
        </span>
        <div {...stylex.props(styles.pager)}>
          <button type="button" aria-label="Previous page" disabled={page() <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} {...stylex.props(s.btnIcon)}>
            <ChevronLeftIcon size={14} />
          </button>
          <span {...stylex.props(styles.pageLabel)}>
            {page()} / {totalPages()}
          </span>
          <button type="button" aria-label="Next page" disabled={page() >= totalPages()} onClick={() => setPage((p) => p + 1)} {...stylex.props(s.btnIcon)}>
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>

      <Show when={uploadOpen()}>
        <FileUploadModal kind={kind} onClose={() => setUploadOpen(false)} />
      </Show>
      <Show when={editing()}>
        <FileEditor kind={kind} item={editing()!} onClose={() => setEditing(null)} />
      </Show>
      <Show when={picking()}>
        <FilePicker kind={kind} title={`Pick a ${meta.noun} ref`} onPick={onPicked} onClose={() => setPicking(false)} />
      </Show>
    </div>
  )
}
