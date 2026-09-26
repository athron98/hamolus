import { createQuery } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { MediaObject } from '@hamolus/types'
import { api } from '../lib/api'
import { resolveMediaUrl } from '../lib/media'
import { s, tokens } from '../theme.stylex'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from './Icons'

const PAGE_SIZE = 24

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
    maxWidth: 760,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
    minHeight: 120,
  },
  tile: {
    position: 'relative',
    aspectRatio: '1 / 1',
    overflow: 'hidden',
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    borderStyle: 'none',
    padding: 0,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    transition: `box-shadow 0.2s cubic-bezier(0.34, 1.4, 0.64, 1), transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1)`,
    ':hover': {
      boxShadow: `0 0 0 1px ${tokens.accent}, ${tokens.shadow}`,
      transform: 'translateY(-2px)',
    },
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  tileMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '3px 6px',
    fontSize: 10,
    color: tokens.text,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
    padding: 32,
    textAlign: 'center',
    color: tokens.textDim,
    fontSize: 13,
  },
})

function focusStyle(item: MediaObject): Record<string, string> {
  if (item.focusX === null || item.focusY === null) return { 'object-position': 'center center' }
  return { 'object-position': `${item.focusX}% ${item.focusY}%` }
}

export function MediaPicker(props: {
  onClose: () => void
  onPick: (item: MediaObject) => void
  title?: string
}) {
  const [search, setSearch] = createSignal('')
  const [page, setPage] = createSignal(1)
  const query = createQuery(() => ({
    queryKey: ['media-picker', page(), search()] as const,
    queryFn: () =>
      api.listMedia({ page: page(), pageSize: PAGE_SIZE, search: search() || undefined }),
  }))

  const rows = () => query.data?.data ?? []
  const meta = () => query.data?.meta
  const totalPages = () => Math.max(1, meta()?.totalPages ?? 1)

  return (
    <div {...stylex.props(styles.overlay)} onClick={props.onClose}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <h2 {...stylex.props(s.heading)}>{props.title ?? 'Choose media'}</h2>
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
            placeholder="Search media…"
            value={search()}
            onInput={(e) => {
              setSearch(e.currentTarget.value)
              setPage(1)
            }}
            {...stylex.props(styles.search)}
          />
        </div>

        <Show when={query.isLoading}>
          <div {...stylex.props(styles.empty)}>Loading media…</div>
        </Show>
        <Show when={query.isError}>
          <div {...stylex.props(styles.empty)}>Failed to load media.</div>
        </Show>

        <Show when={!query.isLoading && !query.isError && rows().length === 0}>
          <div {...stylex.props(styles.empty)}>
            {search() ? 'No media match the search.' : 'No media yet — upload some first.'}
          </div>
        </Show>

        <Show when={!query.isLoading && !query.isError && rows().length > 0}>
          <div {...stylex.props(styles.grid)}>
            <For each={rows()}>
              {(item) => (
                <button
                  type="button"
                  title={`${item.name}${item.width ? ` · ${item.width}×${item.height}` : ''}`}
                  onClick={() => props.onPick(item)}
                  {...stylex.props(styles.tile)}
                >
                  <img src={resolveMediaUrl(item.thumbUrl ?? item.url)} alt="" loading="lazy" {...stylex.props(styles.thumb)} style={focusStyle(item)} />
                  <span {...stylex.props(styles.tileMeta)}>{item.name}</span>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div {...stylex.props(styles.footer)}>
          {(() => { const m = meta(); return (
          <span {...stylex.props(styles.count)}>
            {m ? `${m.total} ${m.total === 1 ? 'asset' : 'assets'}` : ''}
          </span>
          ) })()}
          <div {...stylex.props(styles.pager)}>
            <button
              type="button"
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