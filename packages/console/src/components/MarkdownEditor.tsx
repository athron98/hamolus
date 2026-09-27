/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createMemo, createSignal, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { RichTextFormat } from '@hamolus/types'
import { markdownToHtml } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'

const styles = stylex.create({
  tabs: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
  },
  tabBtn: {
    minHeight: 26,
    padding: '0 10px',
    fontSize: 11,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: `background-color 0.18s ${'cubic-bezier(0.4,0,0.2,1)'}, color 0.18s ${'cubic-bezier(0.4,0,0.2,1)'}`,
    ':hover': { backgroundColor: tokens.surfaceRaised, color: tokens.text },
  },
  tabActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    ':hover': { backgroundColor: tokens.accentSoft, color: tokens.accent },
  },
  hint: {
    fontSize: 11,
    color: tokens.textDim,
    marginLeft: 'auto',
    alignSelf: 'center',
  },
})

export function MarkdownEditor(props: {
  value: () => string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  mode?: RichTextFormat
}) {
  const [tab, setTab] = createSignal<'write' | 'preview'>('write')
  const html = createMemo(() => markdownToHtml(props.value() ?? ''))
  return (
    <div>
      <div {...stylex.props(styles.tabs)}>
        <button
          type="button"
          {...stylex.props(styles.tabBtn, tab() === 'write' && styles.tabActive)}
          onClick={() => setTab('write')}
        >
          Write
        </button>
        <button
          type="button"
          {...stylex.props(styles.tabBtn, tab() === 'preview' && styles.tabActive)}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
        <span {...stylex.props(styles.hint)}>{props.mode === 'mdx' ? 'mdx' : 'markdown'}</span>
      </div>
      <Show
        when={tab() === 'write'}
        fallback={<div class="markdown-preview" innerHTML={html()} />}
      >
        <textarea
          {...stylex.props(s.textarea)}
          spellcheck={false}
          value={String(props.value() ?? '')}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          placeholder={props.placeholder}
        />
      </Show>
    </div>
  )
}