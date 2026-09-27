/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { tokens } from '../theme.stylex'

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v))
}

const styles = stylex.create({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  box: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: tokens.radiusSm,
    overflow: 'hidden',
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    cursor: 'crosshair',
    touchAction: 'none',
    userSelect: 'none',
  },
  image: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
    pointerEvents: 'none',
  },
  marker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '::before': {
      content: '""',
      position: 'absolute',
      inset: '50%',
      width: 1,
      height: '100%',
      backgroundColor: 'rgba(255,255,255,0.95)',
      transform: 'translate(-50%, -50%)',
    },
    '::after': {
      content: '""',
      position: 'absolute',
      inset: '50%',
      width: '100%',
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.95)',
      transform: 'translate(-50%, -50%)',
    },
  },
  markerCore: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: tokens.accent,
    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)',
    position: 'relative',
    zIndex: 1,
  },
  readout: {
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
  },
})

/**
 * Draggable focus-point editor over an image. Coordinates are percentages
 * (0–100). Callers wrap `setFocus` with null-coalescing to 50.
 */
export function FocusPicker(props: {
  imageUrl: string
  x: number
  y: number
  onChange: (x: number, y: number) => void
  label?: string
}) {
  const [pos, setPos] = createSignal({ x: props.x, y: props.y })
  const [dragging, setDragging] = createSignal(false)
  let box: HTMLDivElement | undefined

  const updateFromEvent = (e: PointerEvent) => {
    const el = box
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100)
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100)
    setPos({ x, y })
    props.onChange(x, y)
  }

  return (
    <div {...stylex.props(styles.wrap)}>
      <div
        ref={box}
        role="application"
        aria-label={props.label ?? 'Focus point — drag to set the crop focal point'}
        {...stylex.props(styles.box)}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          setDragging(true)
          updateFromEvent(e)
        }}
        onPointerMove={(e) => {
          if (dragging()) updateFromEvent(e)
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <img src={props.imageUrl} alt="" {...stylex.props(styles.image)} />
        <div
          {...stylex.props(styles.marker)}
          style={{ left: `${pos().x}%`, top: `${pos().y}%` }}
        >
          <span {...stylex.props(styles.markerCore)} />
        </div>
      </div>
      <span {...stylex.props(styles.readout)}>
        Focus: {Math.round(pos().x)}%, {Math.round(pos().y)}%
      </span>
    </div>
  )
}