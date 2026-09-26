import { createSignal, onCleanup, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { MaximizeIcon, MinimizeIcon, XIcon } from './Icons'

const EXIT_MS = 300

const overlayIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

const overlayOut = stylex.keyframes({
  from: { opacity: 1 },
  to: { opacity: 0 },
})

const panelIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(72px) scale(0.98)' },
  '60%': { transform: 'translateY(-5px) scale(1.004)' },
  '80%': { transform: 'translateY(1px) scale(0.999)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
})

const panelOut = stylex.keyframes({
  from: { opacity: 1, transform: 'translateY(0) scale(1)' },
  to: { opacity: 0, transform: 'translateY(56px) scale(0.965)' },
})

const rise = 'cubic-bezier(0.22, 1, 0.36, 1)'
const sink = 'cubic-bezier(0.4, 0, 0.6, 1)'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  overlayIn: {
    animationName: overlayIn,
    animationDuration: '0.5s',
    animationTimingFunction: rise,
    animationFillMode: 'both',
  },
  overlayOut: {
    animationName: overlayOut,
    animationDuration: '0.3s',
    animationTimingFunction: sink,
    animationFillMode: 'both',
  },
  panel: {
    position: 'absolute',
    top: tokens.sheetTop,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadow,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    overflow: 'hidden',
  },
  panelFull: {
    top: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    boxShadow: 'none',
  },
  panelIn: {
    animationName: panelIn,
    animationDuration: '0.5s',
    animationTimingFunction: rise,
    animationFillMode: 'both',
  },
  panelOut: {
    animationName: panelOut,
    animationDuration: '0.3s',
    animationTimingFunction: sink,
    animationFillMode: 'both',
  },
  handle: {
    flexShrink: 0,
    width: 40,
    height: 4,
    margin: '8px auto 4px',
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.borderStrong,
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '4px 16px 8px 20px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 24px',
  },
})

export type SheetApi = {
  requestClose: () => void
  isClosing: () => boolean
}

export function Sheet(props: {
  title?: string
  onCloseRequest?: () => boolean | Promise<boolean | void>
  onExited?: () => void
  onReady?: (api: SheetApi) => void
  children?: JSX.Element
}) {
  const [closing, setClosing] = createSignal(false)
  const [fullscreen, setFullscreen] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const requestClose = async () => {
    if (closing()) return
    let allow: boolean | void = true
    try {
      if (props.onCloseRequest) allow = await props.onCloseRequest()
    } catch {
      return
    }
    if (allow === false) return
    setClosing(true)
    timer = setTimeout(() => props.onExited?.(), EXIT_MS)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') requestClose()
  }

  onMount(() => {
    window.addEventListener('keydown', onKey)
    props.onReady?.({ requestClose, isClosing: closing })
  })
  onCleanup(() => {
    window.removeEventListener('keydown', onKey)
    if (timer) clearTimeout(timer)
  })

  return (
    <div
      {...stylex.props(
        styles.overlay,
        closing() ? styles.overlayOut : styles.overlayIn,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        {...stylex.props(
          styles.panel,
          fullscreen() && styles.panelFull,
          closing() ? styles.panelOut : styles.panelIn,
        )}
      >
        <div {...stylex.props(styles.handle)} aria-hidden="true" />
        <div {...stylex.props(styles.header)}>
          <h2 {...stylex.props(s.heading)}>{props.title}</h2>
          <div {...stylex.props(styles.headerActions)}>
            <button
              type="button"
              aria-label={fullscreen() ? 'Exit fullscreen' : 'Toggle fullscreen'}
              title={fullscreen() ? 'Exit fullscreen' : 'Toggle fullscreen'}
              onClick={() => setFullscreen((cur) => !cur)}
              {...stylex.props(s.btnIcon)}
            >
              {fullscreen() ? <MinimizeIcon size={15} /> : <MaximizeIcon size={15} />}
            </button>
            <button
              type="button"
              aria-label="Close"
              title="Close"
              onClick={requestClose}
              {...stylex.props(s.btnIcon)}
            >
              <XIcon size={15} />
            </button>
          </div>
        </div>
        <div {...stylex.props(styles.body)}>{props.children}</div>
      </div>
    </div>
  )
}