/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, For, onCleanup, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { MediaObject, MediaVariant } from '@hamolus/types'
import { resolveMediaUrl } from '../lib/media'
import { s, tokens } from '../theme.stylex'
import { CopyIcon, ExternalLinkIcon, PencilIcon, XIcon } from './Icons'

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 55,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(8, 10, 16, 0.78)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    flexWrap: 'wrap',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.94)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  caption: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.72)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    borderStyle: 'none',
    borderRadius: tokens.radius,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.82)',
    cursor: 'pointer',
    transition: 'background-color 0.18s ease, color 0.18s ease, transform 0.15s ease',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      color: '#ffffff',
    },
    ':active': {
      transform: 'scale(0.96)',
    },
  },
  stage: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 20px 16px',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: tokens.radius,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.35)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    padding: '0 16px 16px',
  },
  chip: {
    padding: '4px 11px',
    fontSize: 12,
    fontWeight: 600,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.72)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.16s ease, color 0.16s ease',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
      color: '#ffffff',
    },
  },
  chipActive: {
    backgroundColor: tokens.accent,
    color: '#ffffff',
    ':hover': {
      backgroundColor: tokens.accent,
      color: '#ffffff',
    },
  },
  empty: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
})

type Viewable = { url: string; focusX: number | null; focusY: number | null; label: string; meta: string }

export function MediaViewer(props: {
  item: MediaObject
  onClose: () => void
  onEdit: (item: MediaObject) => void
}) {
  const [sel, setSel] = createSignal<string>(props.item.id)
  const [copied, setCopied] = createSignal(false)

  const current = (): Viewable => {
    if (sel() === props.item.id) {
      const focusX = props.item.focusX
      const focusY = props.item.focusY
      const dims = props.item.width && props.item.height ? `${props.item.width}×${props.item.height}` : '—'
      return {
        url: props.item.url,
        focusX,
        focusY,
        label: 'Default',
        meta: `${props.item.mime.replace('image/', '')} · ${dims}`,
      }
    }
    const v = props.item.variants.find((x: MediaVariant) => x.key === sel())
    if (v) {
      const dims = v.width && v.height ? `${v.width}×${v.height}` : '—'
      return {
        url: v.url,
        focusX: v.focusX,
        focusY: v.focusY,
        label: v.label,
        meta: `${props.item.mime.replace('image/', '')} · ${dims}`,
      }
    }
    return {
      url: props.item.url,
      focusX: props.item.focusX,
      focusY: props.item.focusY,
      label: 'Default',
      meta: props.item.mime.replace('image/', ''),
    }
  }

  const focusStyle = (): Record<string, string> => {
    const c = current()
    return {
      objectPosition:
        c.focusX !== null && c.focusY !== null ? `${c.focusX}% ${c.focusY}%` : 'center',
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resolveMediaUrl(current().url))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose()
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => window.removeEventListener('keydown', onKey))

  const hasVariants = () => props.item.variants.length > 0

  return (
    <div {...stylex.props(styles.overlay)} onClick={props.onClose}>
      <div {...stylex.props(styles.bar)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.info)}>
          <span {...stylex.props(styles.name)} title={props.item.name}>
            {props.item.name}
          </span>
          <Show when={props.item.caption}>
            <span {...stylex.props(styles.caption)}>{props.item.caption}</span>
          </Show>
        </div>
        <div {...stylex.props(styles.actions)}>
          <button
            type="button"
            aria-label="Edit media"
            title="Edit"
            {...stylex.props(styles.actionBtn)}
            onClick={() => props.onEdit(props.item)}
          >
            <PencilIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="Copy URL"
            title={copied() ? 'Copied!' : 'Copy URL'}
            {...stylex.props(styles.actionBtn)}
            onClick={copy}
          >
            <CopyIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="Open link in new tab"
            title="Open link"
            {...stylex.props(styles.actionBtn)}
            onClick={() => window.open(resolveMediaUrl(current().url), '_blank', 'noreferrer')}
          >
            <ExternalLinkIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            {...stylex.props(styles.actionBtn)}
            onClick={props.onClose}
          >
            <XIcon size={15} />
          </button>
        </div>
      </div>

      <div {...stylex.props(styles.stage)} onClick={(e) => e.stopPropagation()}>
        <img
          src={resolveMediaUrl(current().url)}
          alt={props.item.alt || props.item.name}
          style={focusStyle()}
          {...stylex.props(styles.image)}
        />
      </div>

      <div {...stylex.props(styles.footer)} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          title="Default asset"
          {...stylex.props(styles.chip, sel() === props.item.id && styles.chipActive)}
          onClick={() => setSel(props.item.id)}
        >
          Default
        </button>
        <For each={props.item.variants}>
          {(v) => (
            <button
              type="button"
              title={v.width && v.height ? `${v.width}×${v.height}` : v.label}
              {...stylex.props(styles.chip, sel() === v.key && styles.chipActive)}
              onClick={() => setSel(v.key)}
            >
              {v.label}
            </button>
          )}
        </For>
        <Show when={!hasVariants()}>
          <span {...stylex.props(styles.meta)}>{current().meta}</span>
        </Show>
        <Show when={hasVariants()}>
          <span {...stylex.props(styles.meta)}>· {current().meta}</span>
        </Show>
      </div>
    </div>
  )
}