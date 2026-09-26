import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query'
import type { MediaObject } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  SlidersIcon,
  TrashIcon,
  UploadIcon,
} from '../components/Icons'
import { MediaEditor } from '../components/MediaEditor'
import { MediaViewer } from '../components/MediaViewer'
import { TaxonomyPanel } from '../components/TaxonomyPanel'
import { UploadModal } from '../components/UploadModal'
import { api } from '../lib/api'
import { logActivity } from '../lib/activity'
import { resolveMediaUrl } from '../lib/media'

const PAGE_SIZE = 24
const VIEW_KEY = 'console-media-view'

type View = 'gallery' | 'dataset'

function storedView(): View {
  return localStorage.getItem(VIEW_KEY) === 'dataset' ? 'dataset' : 'gallery'
}

const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  viewToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: 2,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderRadius: tokens.radiusSm,
  },
  viewBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 26,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.textDim,
    cursor: 'pointer',
    borderRadius: tokens.radiusSm,
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.text },
  },
  viewBtnActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    ':hover': { color: tokens.accent },
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  search: {
    flex: 1,
    minWidth: 140,
    maxWidth: 320,
    padding: '7px 12px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  taxChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  taxChip: {
    padding: '1px 7px',
    fontSize: 10.5,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 120,
  },
  filterSel: {
    maxWidth: 220,
    padding: '7px 10px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2398a1b4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    transition: `box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.34, 1.4, 0.64, 1)',
    ':hover': {
      boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadowCardHover}`,
      transform: 'translateY(-2px)',
    },
  },
  thumb: {
    width: '100%',
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    display: 'block',
    backgroundColor: tokens.bg,
  },
  thumbBtn: {
    width: '100%',
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    cursor: 'pointer',
    display: 'block',
    textAlign: 'left',
  },
  cardBody: {
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  name: {
    fontSize: 12,
    fontWeight: 600,
    color: tokens.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    gap: 4,
    paddingTop: 4,
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: tokens.radius,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    backgroundColor: tokens.surface,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 760,
  },
  th: {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: tokens.textDim,
    padding: '8px 10px',
    whiteSpace: 'nowrap',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
  },
  td: {
    padding: '6px 10px',
    fontSize: 12.5,
    color: tokens.text,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    verticalAlign: 'middle',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowThumb: {
    width: 38,
    height: 38,
    borderRadius: tokens.radiusSm,
    objectFit: 'cover',
    backgroundColor: tokens.bg,
    display: 'block',
    boxShadow: tokens.shadowInput,
  },
  focusCell: {
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
    whiteSpace: 'nowrap',
  },
  tagCells: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  empty: {
    padding: 28,
    textAlign: 'center',
    color: tokens.textDim,
  },
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function focusStyle(item: MediaObject): { objectPosition: string } {
  return {
    objectPosition:
      item.focusX !== null && item.focusY !== null
        ? `${item.focusX}% ${item.focusY}%`
        : 'center',
  }
}

function focusLabel(item: MediaObject): string {
  return item.focusX !== null && item.focusY !== null
    ? `${Math.round(item.focusX)}%, ${Math.round(item.focusY)}%`
    : 'Center'
}

export function MediaPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = createSignal(1)
  const [search, setSearch] = createSignal('')
  const [group, setGroup] = createSignal('')
  const [category, setCategory] = createSignal('')
  const [tag, setTag] = createSignal('')
  const [copied, setCopied] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [editing, setEditing] = createSignal<MediaObject | null>(null)
  const [viewing, setViewing] = createSignal<MediaObject | null>(null)
  const [uploadOpen, setUploadOpen] = createSignal(false)
  const [taxOpen, setTaxOpen] = createSignal(false)
  const [view, setView] = createSignal<View>(storedView())

  const switchView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }

  const taxonomy = createQuery(() => ({
    queryKey: ['media-taxonomy'],
    queryFn: () => api.getMediaTaxonomy().then((r) => r.data),
  }))

  const media = createQuery(() => ({
    queryKey: ['media', page(), search(), group(), category(), tag()] as const,
    queryFn: () =>
      api.listMedia({
        page: page(),
        pageSize: PAGE_SIZE,
        search: search() || undefined,
        group: group() || undefined,
        category: category() || undefined,
        tag: tag() || undefined,
      }),
  }))

  const remove = createMutation(() => ({
    mutationFn: ({ id }: { id: string; name: string }) => api.deleteMedia(id),
    onSuccess: (_data, { name }) => {
      logActivity('media.delete', 'Deleted media', name)
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-taxonomy'] })
      queryClient.invalidateQueries({ queryKey: ['media-taxonomy-detail'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Delete failed'),
  }))

  const copyUrl = async (item: MediaObject) => {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopied(item.id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError('Failed to copy URL')
    }
  }

  const deleteItem = async (item: MediaObject) => {
    if (!confirm(`Delete '${item.name}'?`)) return
    setError(null)
    await remove.mutateAsync({ id: item.id, name: item.name })
  }

  const totalPages = () => media.data?.meta.totalPages ?? 1

  const actions = (item: MediaObject) => (
    <div {...stylex.props(styles.actions)}>
      <button
        type="button"
        title="Edit name, size and SEO metadata"
        aria-label="Edit media"
        {...stylex.props(s.btnIcon, s.btnIconSm)}
        onClick={() => setEditing(item)}
      >
        <PencilIcon size={14} />
      </button>
      <button
        type="button"
        title={copied() === item.id ? 'Copied!' : 'Copy URL'}
        aria-label="Copy URL"
        {...stylex.props(s.btnIcon, s.btnIconSm)}
        onClick={() => copyUrl(item)}
      >
        <CopyIcon size={14} />
      </button>
      <button
        type="button"
        title="Open link in new tab"
        aria-label="Open link"
        {...stylex.props(s.btnIcon, s.btnIconSm)}
        onClick={() => window.open(resolveMediaUrl(item.url), '_blank', 'noreferrer')}
      >
        <ExternalLinkIcon size={14} />
      </button>
      <button
        type="button"
        title="Delete"
        aria-label="Delete"
        {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
        onClick={() => deleteItem(item)}
      >
        <TrashIcon size={14} />
      </button>
    </div>
  )

  return (
    <div {...stylex.props(s.page)}>
      <Show when={editing()}>
        <MediaEditor item={editing()!} onClose={() => setEditing(null)} />
      </Show>
      <Show when={viewing()}>
        <MediaViewer
          item={viewing()!}
          onClose={() => setViewing(null)}
          onEdit={(item) => setEditing(item)}
        />
      </Show>
      <Show when={uploadOpen()}>
        <UploadModal onClose={() => setUploadOpen(false)} />
      </Show>
      <Show when={taxOpen()}>
        <TaxonomyPanel onClose={() => setTaxOpen(false)} />
      </Show>

      <div {...stylex.props(styles.header)}>
        <div>
          <h1 {...stylex.props(s.heading)}>Media</h1>
          <p {...stylex.props(s.subheading)}>Images stored in Cloudflare R2</p>
        </div>
        <div {...stylex.props(styles.headerActions)}>
          <button
            type="button"
            title="Manage groups, categories and tags"
            {...stylex.props(s.btn, s.btnGhost)}
            onClick={() => setTaxOpen(true)}
          >
            <SlidersIcon size={15} />
            <span>Manage taxonomy</span>
          </button>
          <div {...stylex.props(styles.viewToggle)} role="group" aria-label="Media view">
            <button
              type="button"
              title="Gallery view"
              aria-label="Gallery view"
              aria-pressed={view() === 'gallery'}
              onClick={() => switchView('gallery')}
              {...stylex.props(styles.viewBtn, view() === 'gallery' && styles.viewBtnActive)}
            >
              <GridIcon size={14} />
            </button>
            <button
              type="button"
              title="Dataset view"
              aria-label="Dataset view"
              aria-pressed={view() === 'dataset'}
              onClick={() => switchView('dataset')}
              {...stylex.props(styles.viewBtn, view() === 'dataset' && styles.viewBtnActive)}
            >
              <ListIcon size={14} />
            </button>
          </div>
          <button
            type="button"
            title="Upload images"
            {...stylex.props(s.btn)}
            onClick={() => setUploadOpen(true)}
          >
            <UploadIcon size={15} />
            <span>Upload</span>
          </button>
        </div>
      </div>

      <div {...stylex.props(styles.filterBar)}>
        <input
          type="text"
          placeholder="Search media…"
          value={search()}
          onInput={(e) => {
            setSearch(e.currentTarget.value)
            setPage(1)
          }}
          {...stylex.props(styles.search)}
        />
        <select
          aria-label="Filter by group"
          title="Filter by group"
          onChange={(e) => {
            setGroup(e.currentTarget.value)
            setPage(1)
          }}
          {...stylex.props(styles.filterSel)}
        >
          <option value="" selected={group() === ''}>All groups</option>
          <For each={taxonomy.data?.groups ?? []}>
            {(g) => <option value={g} selected={group() === g}>{g}</option>}
          </For>
        </select>
        <select
          aria-label="Filter by category"
          title="Filter by category"
          onChange={(e) => {
            setCategory(e.currentTarget.value)
            setPage(1)
          }}
          {...stylex.props(styles.filterSel)}
        >
          <option value="" selected={category() === ''}>All categories</option>
          <For each={taxonomy.data?.categories ?? []}>
            {(c) => <option value={c} selected={category() === c}>{c}</option>}
          </For>
        </select>
        <select
          aria-label="Filter by tag"
          title="Filter by tag"
          onChange={(e) => {
            setTag(e.currentTarget.value)
            setPage(1)
          }}
          {...stylex.props(styles.filterSel)}
        >
          <option value="" selected={tag() === ''}>All tags</option>
          <For each={taxonomy.data?.tags ?? []}>
            {(t) => <option value={t} selected={tag() === t}>{t}</option>}
          </For>
        </select>
      </div>

      <Show when={error()}>
        <p {...stylex.props(s.error)}>{error()}</p>
      </Show>

      <Show
        when={!media.isLoading && media.data}
        fallback={<p {...stylex.props(s.muted)}>Loading media…</p>}
      >
        <Show
          when={media.data!.data.length > 0}
          fallback={<div {...stylex.props(styles.empty)}>No media yet. Upload an image.</div>}
        >
          <Show when={view() === 'gallery'} fallback={null}>
            <div {...stylex.props(styles.grid)}>
              <For each={media.data!.data}>
                {(item) => (
                  <div {...stylex.props(styles.card)}>
                    <button
                      type="button"
                      title="View image"
                      aria-label="View image"
                      onClick={() => setViewing(item)}
                      {...stylex.props(styles.thumbBtn)}
                    >
                      <img
                        src={resolveMediaUrl(item.thumbUrl ?? item.url)}
                        alt={item.alt || item.name}
                        title={item.title || item.name}
                        loading="lazy"
                        style={focusStyle(item)}
                        {...stylex.props(styles.thumb)}
                      />
                    </button>
                    <div {...stylex.props(styles.cardBody)}>
                      <span title={item.name} {...stylex.props(styles.name)}>
                        {item.name}
                      </span>
                      <span {...stylex.props(styles.meta)}>
                        {item.mime.replace('image/', '')} · {formatSize(item.size)}
                        {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                      </span>
                      <div {...stylex.props(styles.taxChips)}>
                        <Show when={item.group}>
                          <span title={`Group: ${item.group}`} {...stylex.props(styles.taxChip)}>
                            {item.group}
                          </span>
                        </Show>
                        <Show when={item.category}>
                          <span title={`Category: ${item.category}`} {...stylex.props(styles.taxChip)}>
                            {item.category}
                          </span>
                        </Show>
                        <For each={item.tags}>
                          {(t) => (
                            <span title={`Tag: ${t}`} {...stylex.props(styles.taxChip)}>
                              {t}
                            </span>
                          )}
                        </For>
                      </div>
                      {actions(item)}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={view() === 'dataset'}>
            <div {...stylex.props(styles.tableWrap)}>
              <table {...stylex.props(styles.table)}>
                <thead>
                  <tr>
                    <th {...stylex.props(styles.th)}>Preview</th>
                    <th {...stylex.props(styles.th)}>Name</th>
                    <th {...stylex.props(styles.th)}>Type</th>
                    <th {...stylex.props(styles.th)}>Dimensions</th>
                    <th {...stylex.props(styles.th)}>Size</th>
                    <th {...stylex.props(styles.th)}>Group</th>
                    <th {...stylex.props(styles.th)}>Category</th>
                    <th {...stylex.props(styles.th)}>Tags</th>
                    <th {...stylex.props(styles.th)}>Focus</th>
                    <th {...stylex.props(styles.th)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={media.data!.data}>
                    {(item) => (
                      <tr>
                        <td {...stylex.props(styles.td)}>
                          <a
                            href={resolveMediaUrl(item.url)}
                            target="_blank"
                            rel="noreferrer"
                            title="Open original"
                          >
                            <img
                              src={resolveMediaUrl(item.thumbUrl ?? item.url)}
                              alt=""
                              loading="lazy"
                              style={focusStyle(item)}
                              {...stylex.props(styles.rowThumb)}
                            />
                          </a>
                        </td>
                        <td {...stylex.props(styles.td)}>
                          <span title={item.name}>{item.name}</span>
                          <Show when={item.title}>
                            <div {...stylex.props(styles.meta)} title={item.title ?? undefined}>
                              {item.title}
                            </div>
                          </Show>
                        </td>
                        <td {...stylex.props(styles.td, styles.meta)}>{item.mime}</td>
                        <td {...stylex.props(styles.td, styles.focusCell)}>
                          {item.width && item.height ? `${item.width}×${item.height}` : '—'}
                        </td>
                        <td {...stylex.props(styles.td, styles.meta)}>{formatSize(item.size)}</td>
                        <td {...stylex.props(styles.td)}>{item.group || '—'}</td>
                        <td {...stylex.props(styles.td)}>{item.category || '—'}</td>
                        <td {...stylex.props(styles.td)}>
                          <div {...stylex.props(styles.tagCells)}>
                            <For each={item.tags}>
                              {(t) => (
                                <span title={`Tag: ${t}`} {...stylex.props(styles.taxChip)}>
                                  {t}
                                </span>
                              )}
                            </For>
                            <Show when={item.tags.length === 0}>
                              <span {...stylex.props(styles.meta)}>—</span>
                            </Show>
                          </div>
                        </td>
                        <td {...stylex.props(styles.td, styles.focusCell)}>{focusLabel(item)}</td>
                        <td {...stylex.props(styles.td)}>{actions(item)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          <Show when={totalPages() > 1}>
            <div {...stylex.props(styles.pagination)}>
              <button
                type="button"
                aria-label="Previous page"
                title="Previous page"
                disabled={page() <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                {...stylex.props(s.btnIcon)}
              >
                <ChevronLeftIcon size={15} />
              </button>
              <span {...stylex.props(s.muted)}>
                Page {media.data!.meta.page} of {totalPages()}
              </span>
              <button
                type="button"
                aria-label="Next page"
                title="Next page"
                disabled={page() >= totalPages()}
                onClick={() => setPage((p) => p + 1)}
                {...stylex.props(s.btnIcon)}
              >
                <ChevronRightIcon size={15} />
              </button>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}