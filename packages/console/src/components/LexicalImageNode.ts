import {
  $applyNodeReplacement,
  createCommand,
  ElementNode,
  setDOMUnmanaged,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { resolveMediaUrl } from '../lib/media'

/** Serialized shape of an embedded media image. */
export type SerializedImageNode = Spread<
  {
    src: string
    alt: string | null
    width: number | null
    height: number | null
    type: 'image'
    version: 1
  },
  SerializedElementNode
>

/** Payload for inserting a media image: a MediaObject subset. */
export type InsertImagePayload = {
  src: string
  alt?: string | null
  width?: number | null
  height?: number | null
}

export const INSERT_IMAGE_COMMAND = createCommand<InsertImagePayload>('INSERT_IMAGE_COMMAND')

/**
 * Block image node backed by the media library. Extends ElementNode (no
 * framework renderer is wired in this editor) and carries its `<img>`
 * subtree created in `createDOM`; `updateDOM` returns `false` and the span is
 * marked unmanaged so the mutation observer never evicts the injected image.
 * Images serialize through `exportJSON`/`importJSON` so they survive
 * `editorState.toJSON()`/`parseEditorState` round-trips.
 */
export class ImageNode extends ElementNode {
  __src: string
  __alt: string | null
  __width: number | null
  __height: number | null

  static override getType(): string {
    return 'image'
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__width, node.__height, node.__key)
  }

  constructor(src: string, alt?: string | null, width?: number | null, height?: number | null, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__alt = alt ?? null
    this.__width = width ?? null
    this.__height = height ?? null
  }

  override createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const span = document.createElement('span')
    span.className = 'lexical-image'
    span.contentEditable = 'false'
    span.style.display = 'block'
    span.style.textAlign = 'center'
    span.style.padding = '6px 0'
    const img = document.createElement('img')
    img.src = resolveMediaUrl(this.__src)
    img.alt = this.__alt ?? ''
    img.style.maxWidth = '100%'
    if (this.__width && this.__width > 0) img.width = this.__width
    if (this.__height && this.__height > 0) img.height = this.__height
    span.appendChild(img)
    setDOMUnmanaged(span as unknown as Parameters<typeof setDOMUnmanaged>[0])
    return span
  }

  override updateDOM(): boolean {
    return false
  }

  override isInline(): boolean {
    return false
  }

  override canBeEmpty(): boolean {
    return true
  }

  override exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      src: this.__src,
      alt: this.__alt,
      width: this.__width,
      height: this.__height,
      type: 'image',
      version: 1,
    }
  }

  static override importJSON(serialized: SerializedImageNode): ImageNode {
    return $createImageNode(serialized.src, serialized.alt, serialized.width, serialized.height)
  }
}

export function $createImageNode(
  src: string,
  alt?: string | null,
  width?: number | null,
  height?: number | null,
): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, alt, width, height))
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}