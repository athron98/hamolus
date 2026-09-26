import * as stylex from '@stylexjs/stylex'
import { createSignal, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { FORMAT_TEXT_COMMAND, type LexicalEditor, type TextFormatType } from 'lexical'
import { $createHeadingNode, type HeadingTagType } from '@lexical/rich-text'
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from '@lexical/list'
import { $toggleLink } from '@lexical/link'
import { $getSelection, $isRangeSelection } from 'lexical'
import { tokens } from '../theme.stylex'
import { ImageIcon } from './Icons'
import { MediaPicker } from './MediaPicker'
import { INSERT_IMAGE_COMMAND } from './LexicalImageNode'
import type { MediaObject } from '@hamolus/types'

const styles = stylex.create({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '4px 6px',
    backgroundColor: tokens.surface,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tokens.borderStrong,
    borderBottomStyle: 'none',
    borderRadius: `${tokens.radiusSm} ${tokens.radiusSm} 0 0`,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    height: 28,
    padding: '0 6px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': {
      color: tokens.text,
      backgroundColor: tokens.surfaceRaised,
    },
  },
  sep: {
    width: 1,
    height: 18,
    margin: '0 4px',
    backgroundColor: tokens.borderStrong,
  },
})

function Btn(props: {
  label?: string
  icon?: JSX.Element
  title: string
  onClick: () => void
  style?: Record<string, string>
}) {
  return (
    <button
      type="button"
      title={props.title}
      onMouseDown={(e) => {
        e.preventDefault()
        props.onClick()
      }}
      {...stylex.props(styles.btn)}
      style={props.style}
    >
      {props.icon ?? props.label}
    </button>
  )
}

function Sep() {
  return <div {...stylex.props(styles.sep)} />
}

export function LexicalToolbar(props: { editor: () => LexicalEditor | null }) {
  const format = (type: TextFormatType) => {
    props.editor()?.dispatchCommand(FORMAT_TEXT_COMMAND, type)
  }

  const insertHeading = (tag: HeadingTagType) => {
    const ed = props.editor()
    if (!ed) return
    ed.update(() => {
      const sel = $getSelection()
      if ($isRangeSelection(sel)) {
        const node = $createHeadingNode(tag)
        sel.insertNodes([node])
      }
    })
  }

  const toggleList = (type: 'bullet' | 'number') => {
    const ed = props.editor()
    if (!ed) return
    if (type === 'bullet') {
      ed.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    } else {
      ed.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    }
  }

  const removeListCmd = () => {
    props.editor()?.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
  }

  const insertLink = () => {
    const url = window.prompt('Enter URL:')
    if (url !== null) {
      const ed = props.editor()
      if (!ed) return
      ed.update(() => $toggleLink(url))
    }
  }

  const [pickerOpen, setPickerOpen] = createSignal(false)
  const insertImage = (item: MediaObject) => {
    props.editor()?.dispatchCommand(INSERT_IMAGE_COMMAND, {
      src: item.url,
      alt: item.alt,
      width: item.width,
      height: item.height,
    })
    setPickerOpen(false)
  }

  return (
    <div {...stylex.props(styles.toolbar)}>
      <Btn label="B" title="Bold" onClick={() => format('bold')} style={{ 'font-weight': '700' }} />
      <Btn label="I" title="Italic" onClick={() => format('italic')} style={{ 'font-style': 'italic' }} />
      <Btn label="U" title="Underline" onClick={() => format('underline')} style={{ 'text-decoration': 'underline' }} />
      <Btn label="S" title="Strikethrough" onClick={() => format('strikethrough')} style={{ 'text-decoration': 'line-through' }} />
      <Sep />
      <Btn label="H1" title="Heading 1" onClick={() => insertHeading('h1')} style={{ 'font-size': '11px' }} />
      <Btn label="H2" title="Heading 2" onClick={() => insertHeading('h2')} style={{ 'font-size': '11px' }} />
      <Btn label="H3" title="Heading 3" onClick={() => insertHeading('h3')} style={{ 'font-size': '11px' }} />
      <Sep />
      <Btn label={'\u2022'} title="Bullet List" onClick={() => toggleList('bullet')} style={{ 'font-size': '14px' }} />
      <Btn label="1." title="Numbered List" onClick={() => toggleList('number')} style={{ 'font-size': '11px' }} />
      <Btn label="x" title="Remove List" onClick={removeListCmd} style={{ 'font-size': '11px' }} />
      <Sep />
      <Btn label="Link" title="Insert Link" onClick={insertLink} style={{ 'font-size': '11px' }} />
      <Btn
        icon={<ImageIcon size={13} />}
        title="Insert image from media"
        onClick={() => setPickerOpen(true)}
        style={{ 'padding': '0 5px' }}
      />
      <Show when={pickerOpen()}>
        <MediaPicker
          title="Insert image"
          onClose={() => setPickerOpen(false)}
          onPick={insertImage}
        />
      </Show>
    </div>
  )
}
