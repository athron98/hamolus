/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { onCleanup, onMount, untrack } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  type LexicalEditor as LexicalEditorInstance,
} from 'lexical'
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text'
import { ListNode, ListItemNode, registerList } from '@lexical/list'
import { LinkNode, $toggleLink, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $getSelection, $isRangeSelection } from 'lexical'
import { tokens } from '../theme.stylex'
import { LexicalToolbar } from './LexicalToolbar'
import {
  ImageNode,
  INSERT_IMAGE_COMMAND,
  $createImageNode,
  type InsertImagePayload,
} from './LexicalImageNode'

const styles = stylex.create({
  wrap: {
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 8,
    left: 10,
    color: tokens.textDim,
    fontStyle: 'italic',
    fontSize: 13,
    pointerEvents: 'none',
  },
})

export type LexicalValue = string | Record<string, unknown> | null | undefined

type ParseParam = Parameters<LexicalEditorInstance['parseEditorState']>[0]

/** Normalize a stored richtext value (JSON string or parsed object) into editor-state JSON. */
function toEditorState(value: LexicalValue): ParseParam | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') {
    if (value.root) return value as unknown as ParseParam
    return null
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && (parsed as { root?: unknown }).root) {
      return parsed as unknown as ParseParam
    }
  } catch {
    // plain text fallback
  }
  return null
}

function initEditorState(editor: LexicalEditorInstance, saved: LexicalValue): void {
  const state = toEditorState(saved)
  if (state) {
    editor.setEditorState(editor.parseEditorState(state))
    return
  }
  editor.update(() => {
    const root = $getRoot()
    if (root.getFirstChild() === null) {
      const p = $createParagraphNode()
      p.append($createTextNode(typeof saved === 'string' ? saved : ''))
      root.append(p)
    }
  })
}

/** Extract plain text from a richtext value (JSON string or parsed Lexical state). */
export function getPlainTextFromLexical(value: LexicalValue): string {
  if (value === null || value === undefined || value === '') return ''
  try {
    const json = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
    if (json && typeof json === 'object' && (json as Record<string, unknown>).root) {
      const texts: string[] = []
      const walk = (node: Record<string, unknown>) => {
        if (node.type === 'text' && typeof node.text === 'string') texts.push(node.text)
        if (Array.isArray(node.children)) node.children.forEach(walk)
      }
      walk((json as Record<string, unknown>).root as Record<string, unknown>)
      return texts.join(' ')
    }
  } catch {
    // not json
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function LexicalEditor(props: {
  value: () => LexicalValue
  onChange: (value: string) => void
  placeholder?: string
}) {
  let containerRef: HTMLDivElement | undefined
  let editor: LexicalEditorInstance | null = null
  let unsubscribe: (() => void) | null = null
  let contentEditable: HTMLDivElement | null = null

  onMount(() => {
    if (!containerRef) return

    const initial = untrack(() => props.value())

    editor = createEditor({
      namespace: 'RichtextEditor',
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, ImageNode],
      onError: (error: Error) => console.error('[Lexical]', error),
    })

    contentEditable = document.createElement('div')
    contentEditable.contentEditable = 'true'
    contentEditable.spellcheck = false
    contentEditable.className = 'lexical-content'
    containerRef.appendChild(contentEditable)

    editor.setRootElement(contentEditable)
    initEditorState(editor, initial)

    unsubscribe = editor.registerUpdateListener(({ editorState }) => {
      const json = JSON.stringify(editorState.toJSON())
      props.onChange(json)
    })

    // Register the core rich-text/list command handlers. Without these the
    // beforeinput insertText events are swallowed and typing/deleting does nothing.
    registerRichText(editor)
    registerList(editor)

    editor.registerCommand(
      TOGGLE_LINK_COMMAND,
      (url) => {
        editor?.update(() => $toggleLink(url as string | null))
        return true
      },
      1,
    )
    editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const item = payload as unknown as InsertImagePayload
        editor?.update(() => {
          const sel = $getSelection()
          if ($isRangeSelection(sel)) {
            const node = $createImageNode(item.src, item.alt ?? null, item.width ?? null, item.height ?? null)
            sel.insertNodes([node])
          }
        })
        return true
      },
      1,
    )
  })

  onCleanup(() => {
    unsubscribe?.()
    editor?.setRootElement(null)
    editor = null
    unsubscribe = null
    contentEditable?.remove()
    contentEditable = null
  })

  return (
    <div ref={containerRef} {...stylex.props(styles.wrap)}>
      <LexicalToolbar editor={() => editor} />
    </div>
  )
}
