/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { tokens } from '../theme.stylex'

type TokenClass = 'key' | 'str' | 'num' | 'kw' | 'punct' | 'plain'

interface Segment {
  text: string
  cls: TokenClass
}

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\]:,])|([\s\S])/g

function tokenizeJson(src: string): Segment[] {
  const out: Segment[] = []
  for (const m of src.matchAll(TOKEN_RE)) {
    if (m[1] !== undefined) {
      const key = m[2] !== undefined && m[2] !== ''
      out.push({ text: m[1], cls: key ? 'key' : 'str' })
      if (m[2]) out.push({ text: m[2], cls: 'plain' })
    } else if (m[3] !== undefined) {
      out.push({ text: m[3], cls: 'num' })
    } else if (m[4] !== undefined) {
      out.push({ text: m[4], cls: 'kw' })
    } else if (m[5] !== undefined) {
      out.push({ text: m[5], cls: 'punct' })
    } else if (m[6] !== undefined) {
      out.push({ text: m[6], cls: m[6].trim() === '' ? 'plain' : 'punct' })
    }
  }
  return out
}

const styles = stylex.create({
  wrap: {
    position: 'relative',
    display: 'grid',
    color: tokens.text,
  },
  layer: {
    gridArea: '1 / 1',
    margin: 0,
    minHeight: 240,
    padding: '10px 12px',
    fontFamily: tokens.fontMono,
    fontSize: 13,
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'auto',
  },
  textarea: {
    backgroundColor: 'transparent',
    resize: 'vertical',
    outline: 'none',
    borderStyle: 'none',
    boxShadow: tokens.shadowInput,
    borderRadius: tokens.radiusSm,
    color: 'transparent',
    caretColor: tokens.text,
    overflow: 'hidden',
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  pre: {
    pointerEvents: 'none',
    userSelect: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  key: { color: tokens.accent },
  str: { color: tokens.ok },
  num: { color: 'var(--json-num)' },
  kw: { color: 'var(--json-kw)' },
  punct: { color: tokens.textDim },
  plain: { color: tokens.text },
  status: {
    marginTop: 6,
    fontSize: 12,
  },
  ok: {
    color: tokens.ok,
  },
  err: {
    color: tokens.danger,
  },
})

const getTokenStyle = (cls: TokenClass) => {
  switch (cls) {
    case 'key': return styles.key
    case 'str': return styles.str
    case 'num': return styles.num
    case 'kw': return styles.kw
    case 'punct': return styles.punct
    default: return styles.plain
  }
}

export function JsonEditor(props: {
  value: () => string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  ariaLabel?: string
}) {
  const [valid, setValid] = createSignal<null | boolean>(null)
  const [error, setError] = createSignal<string | null>(null)
  let preRef: HTMLPreElement | undefined
  let taRef: HTMLTextAreaElement | undefined

  const segments = createMemo(() => tokenizeJson(props.value()))

  const validate = (src: string) => {
    if (src.trim() === '') {
      setValid(null)
      setError(null)
      return
    }
    try {
      JSON.parse(src)
      setValid(true)
      setError(null)
    } catch (err) {
      setValid(false)
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  let userResized = false

  const resize = () => {
    const ta = taRef
    if (!ta) return
    if (userResized) {
      // User manually dragged — only sync pre, don't override height
      const pre = preRef
      if (pre) pre.scrollTop = ta.scrollTop
      return
    }
    ta.style.height = 'auto'
    const minH = (props.rows ?? 14) * 20 + 20
    const next = Math.max(ta.scrollHeight, minH)
    ta.style.height = `${next}px`
    const pre = preRef
    if (pre) pre.scrollTop = ta.scrollTop
  }

  let resizeCheck: (() => void) | null = null

  const onMouseDown = () => {
    const ta = taRef
    if (!ta) return
    const startHeight = ta.offsetHeight
    const check = () => {
      if (ta.offsetHeight !== startHeight) userResized = true
      cleanup()
    }
    const cleanup = () => {
      window.removeEventListener('pointerup', check)
      window.removeEventListener('mouseup', check)
      if (resizeCheck === check) resizeCheck = null
    }
    resizeCheck = check
    window.addEventListener('pointerup', check)
    window.addEventListener('mouseup', check)
  }

  onCleanup(() => {
    if (resizeCheck) {
      window.removeEventListener('pointerup', resizeCheck)
      window.removeEventListener('mouseup', resizeCheck)
    }
  })

  const onInput = (e: Event) => {
    const v = (e.currentTarget as HTMLTextAreaElement).value
    props.onChange(v)
    validate(v)
    resize()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !taRef) return
    e.preventDefault()
    const ta = taRef
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = props.value().slice(0, start) + '  ' + props.value().slice(end)
    props.onChange(next)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2
    })
  }

  const onScroll = () => {
    const ta = taRef
    const pre = preRef
    if (ta && pre) pre.scrollTop = ta.scrollTop
  }

  onMount(() => {
    validate(props.value())
    resize()
  })

  createEffect(() => {
    props.value()
    resize()
  })

  return (
    <>
      <div {...stylex.props(styles.wrap)}>
        <pre
          ref={preRef}
          aria-hidden="true"
          {...stylex.props(styles.layer, styles.pre)}
        >
          {segments().map((seg) => (
            <span {...stylex.props(getTokenStyle(seg.cls))}>{seg.text}</span>
          ))}
        </pre>
        <textarea
          ref={taRef}
          value={props.value()}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          onMouseDown={onMouseDown}
          spellcheck={false}
          autoCapitalize="off"
          placeholder={props.placeholder}
          aria-label={props.ariaLabel ?? 'JSON editor'}
          rows={props.rows ?? 14}
          {...stylex.props(styles.layer, styles.textarea)}
        />
      </div>
      <Show when={error() !== null || valid() !== null}>
        <p {...stylex.props(styles.status, valid() ? styles.ok : styles.err)}>
          {valid() ? 'Valid JSON.' : error()}
        </p>
      </Show>
    </>
  )
}