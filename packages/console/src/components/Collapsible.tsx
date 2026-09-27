/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createSignal, For, on, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { JSX } from 'solid-js'
import { tokens } from '../theme.stylex'
import { ChevronDownIcon } from './Icons'

const STORE_KEY = 'console-collapse'

function isOpen(id: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return fallback
    const map = JSON.parse(raw) as Record<string, boolean>
    return typeof map[id] === 'boolean' ? map[id] : fallback
  } catch {
    return fallback
  }
}

function saveOpen(id: string, open: boolean): void {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const map: Record<string, boolean> = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    map[id] = open
    localStorage.setItem(STORE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

const bodyIn = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

const styles = stylex.create({
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 12px',
    backgroundColor: tokens.surfaceRaised,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderStyle: 'none',
    borderRadius: tokens.radius,
    cursor: 'pointer',
    transition:
      'background-color 0.18s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': { backgroundColor: tokens.surfaceDeep },
    ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` },
  },
  toggleOpen: {
    backgroundColor: tokens.accentSoft,
    boxShadow: `0 0 0 1px ${tokens.accentBold}`,
    ':hover': { backgroundColor: tokens.accentSoft },
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
    transition: 'color 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  titleOpen: {
    color: tokens.accent,
  },
  meta: {
    flex: 1,
    textAlign: 'left',
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    display: 'inline-flex',
    color: tokens.textDim,
    transition:
      'transform 0.16s cubic-bezier(0.34, 1.4, 0.64, 1), color 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  chevronOpen: {
    transform: 'rotate(180deg)',
    color: tokens.accent,
  },
  body: {
    paddingTop: 10,
  },
  bodyChildren: {
    animationName: bodyIn,
    animationDuration: '0.14s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
})

export function Collapsible(props: {
  id: string
  title: string
  meta?: string
  defaultOpen?: boolean
  children: JSX.Element
}) {
  const [open, setOpen] = createSignal(isOpen(props.id, props.defaultOpen ?? true))

  createEffect(
    on(
      () => props.id,
      (id) => setOpen(isOpen(id, props.defaultOpen ?? true)),
    ),
  )

  const toggle = () => {
    setOpen((cur) => {
      const next = !cur
      saveOpen(props.id, next)
      return next
    })
  }

  return (
    <section>
      <button type="button" onClick={toggle} title={`${open() ? 'Collapse' : 'Expand'} ${props.title}`} {...stylex.props(styles.toggle, open() && styles.toggleOpen)}>
        <span {...stylex.props(styles.title, open() && styles.titleOpen)}>{props.title}</span>
        <Show when={props.meta !== undefined}>
          <span {...stylex.props(styles.meta)}>{props.meta}</span>
        </Show>
        <span {...stylex.props(styles.chevron, open() && styles.chevronOpen)}>
          <ChevronDownIcon size={14} />
        </span>
      </button>
      <Show when={open()}>
        <For each={[props.id]}>
          {() => (
            <div {...stylex.props(styles.body)}>
              <div {...stylex.props(styles.bodyChildren)}>{props.children}</div>
            </div>
          )}
        </For>
      </Show>
    </section>
  )
}