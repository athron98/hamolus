import { createSignal } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { FocusPicker } from './FocusPicker'
import { XIcon } from './Icons'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 70,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    overflowY: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 460,
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
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: tokens.textDim,
  },
})

/**
 * Dedicated focus-point picker, decoupled from the crop/resize dialog.
 * Coordinates are percentages (0–100); `onSave` fires with the final values.
 */
export function FocusDialog(props: {
  url: string
  x: number
  y: number
  onSave: (x: number, y: number) => void
  onClose: () => void
}) {
  const [x, setX] = createSignal(props.x)
  const [y, setY] = createSignal(props.y)
  const [busy, setBusy] = createSignal(false)

  const reset = () => {
    setX(50)
    setY(50)
  }

  return (
    <div {...stylex.props(styles.overlay)} onClick={() => !busy() && props.onClose()}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <div>
            <h2 {...stylex.props(s.heading)}>Focus point</h2>
            <p {...stylex.props(s.subheading)}>
              Where should the focal point of the image sit? Used when thumbnails crop it.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            disabled={busy()}
            onClick={props.onClose}
            {...stylex.props(s.btnIcon)}
          >
            <XIcon size={15} />
          </button>
        </div>

        <FocusPicker imageUrl={props.url} x={x()} y={y()} onChange={(nx, ny) => { setX(nx); setY(ny) }} />

        <p {...stylex.props(styles.hint)}>Center (50%, 50%) means “keep the whole image balanced”.</p>

        <button type="button" onClick={reset} {...stylex.props(s.btn, s.btnGhost)}>
          Reset to center
        </button>

        <div {...stylex.props(styles.footer)}>
          <button type="button" onClick={props.onClose} disabled={busy()} {...stylex.props(s.btnGhost)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy()}
            onClick={() => {
              setBusy(true)
              props.onSave(Math.round(x() * 10) / 10, Math.round(y() * 10) / 10)
            }}
            {...stylex.props(s.btn)}
          >
            Save focus
          </button>
        </div>
      </div>
    </div>
  )
}