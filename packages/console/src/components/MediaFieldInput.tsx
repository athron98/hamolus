import { createSignal, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { MediaFieldValue, MediaObject } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { MediaPicker } from './MediaPicker'
import { ImageIcon } from './Icons'
import { resolveMediaUrl } from '../lib/media'

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  thumb: {
    width: 56,
    height: 56,
    flexShrink: 0,
    objectFit: 'cover',
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
  },
  emptyThumb: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    flexShrink: 0,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.surfaceRaised,
    color: tokens.textDim,
  },
  info: {
    minWidth: 0,
    flex: '0 1 auto',
  },
  name: {
    fontSize: 13,
    color: tokens.text,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  sub: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
  },
})

function toFieldValue(item: MediaObject): MediaFieldValue {
  return {
    id: item.id,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    focusX: item.focusX ?? null,
    focusY: item.focusY ?? null,
  }
}

function displayValue(value: unknown): MediaFieldValue | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.url !== 'string') return null
  return {
    id: v.id,
    url: v.url,
    alt: typeof v.alt === 'string' ? v.alt : null,
    width: typeof v.width === 'number' ? v.width : null,
    height: typeof v.height === 'number' ? v.height : null,
    focusX: typeof v.focusX === 'number' ? v.focusX : null,
    focusY: typeof v.focusY === 'number' ? v.focusY : null,
  }
}

function focusStyle(item: MediaFieldValue): Record<string, string> {
  if (item.focusX === null || item.focusY === null) return { 'object-position': 'center center' }
  return { 'object-position': `${item.focusX}% ${item.focusY}%` }
}

export function MediaFieldInput(props: {
  value: () => unknown
  onChange: (value: MediaFieldValue | null) => void
}) {
  const [open, setOpen] = createSignal(false)
  const current = () => displayValue(props.value())

  return (
    <div>
      <div {...stylex.props(styles.row)}>
        <Show
          when={current()}
          fallback={
            <>
              <span {...stylex.props(styles.emptyThumb)}>
                <ImageIcon size={20} />
              </span>
              <button type="button" onClick={() => setOpen(true)} {...stylex.props(s.btnGhost)}>
                Choose image…
              </button>
            </>
          }
        >
          <img
            src={resolveMediaUrl(current()!.url)}
            alt=""
            title={resolveMediaUrl(current()!.url)}
            {...stylex.props(styles.thumb)}
            style={focusStyle(current()!)}
          />
          <div {...stylex.props(styles.info)}>
            <div {...stylex.props(styles.name)} title={resolveMediaUrl(current()!.url)}>
              {current()!.alt || current()!.id.slice(0, 12)}
            </div>
            <div {...stylex.props(styles.sub)}>
              {current()!.width && current()!.height
                ? `${current()!.width} × ${current()!.height} px`
                : 'Media asset'}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)} {...stylex.props(s.btnGhost)}>
            Replace
          </button>
          <button type="button" onClick={() => props.onChange(null)} {...stylex.props(s.btnDanger)}>
            Remove
          </button>
        </Show>
      </div>

      <Show when={open()}>
        <MediaPicker
          title="Choose media"
          onClose={() => setOpen(false)}
          onPick={(item) => {
            props.onChange(toFieldValue(item))
            setOpen(false)
          }}
        />
      </Show>
    </div>
  )
}