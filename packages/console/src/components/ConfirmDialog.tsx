/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { onCleanup, onMount } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    animationName: stylex.keyframes({
      from: { opacity: 0 },
      to: { opacity: 1 },
    }),
    animationDuration: '0.16s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadowCard,
    borderRadius: tokens.radius,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: tokens.text,
  },
  message: {
    fontSize: 13,
    color: tokens.textDim,
    margin: 0,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
})

export function ConfirmDialog(props: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onCancel()
  }

  onMount(() => window.addEventListener('keydown', onKey))
  onCleanup(() => window.removeEventListener('keydown', onKey))

  return (
    <div {...stylex.props(styles.overlay)} role="alertdialog" aria-modal="true" aria-label={props.title}>
      <div {...stylex.props(styles.card)}>
        <h3 {...stylex.props(styles.title)}>{props.title}</h3>
        <p {...stylex.props(styles.message)}>{props.message}</p>
        <div {...stylex.props(styles.actions)}>
          <button type="button" onClick={props.onCancel} {...stylex.props(s.btn, s.btnGhost)}>
            {props.cancelLabel ?? 'Keep editing'}
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            {...stylex.props(s.btn, ...(props.danger ? [s.btnDanger] : []))}
          >
            {props.confirmLabel ?? 'Discard'}
          </button>
        </div>
      </div>
    </div>
  )
}