/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { FileRefValue } from '@hamolus/types'
import type { FileKind } from '../lib/api'
import { fileRefLabel } from '../lib/files'
import { resolveMediaUrl } from '../lib/media'
import { s, tokens } from '../theme.stylex'
import { FilePicker } from './FilePicker'
import { FileTextIcon } from './Icons'

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '48px',
    flexShrink: 0,
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderRadius: tokens.radiusSm,
  },
  emptyTile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '48px',
    flexShrink: 0,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.surfaceRaised,
    color: tokens.textDim,
  },
  info: {
    minWidth: 0,
    flex: '0 1 auto',
  },
  name: {
    fontSize: 13,
    color: tokens.text,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  sub: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 2,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
})

function displayValue(value: unknown): FileRefValue | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.url !== 'string') return null
  return {
    id: v.id,
    url: v.url,
    name: typeof v.name === 'string' ? v.name : null,
    mime: typeof v.mime === 'string' ? v.mime : null,
    size: typeof v.size === 'number' ? v.size : null,
    ext: typeof v.ext === 'string' ? v.ext : null,
  }
}

function toFieldValue(item: { id: string; url: string; name: string; mime: string; size: number; ext: string }): FileRefValue {
  return { id: item.id, url: item.url, name: item.name, mime: item.mime, size: item.size, ext: item.ext }
}

export function FileFieldInput(props: {
  kind: FileKind
  value: () => unknown
  onChange: (value: FileRefValue | null) => void
}) {
  const [open, setOpen] = createSignal(false)
  const current = () => displayValue(props.value())

  return (
    <div>
      <div {...stylex.props(styles.row)}>
        <Show
          when={current()}
          fallback={
            <>
              <span {...stylex.props(styles.emptyTile)}>
                <FileTextIcon size={20} />
              </span>
              <button
                type="button"
                onClick={() => setOpen(true)}
                {...stylex.props(s.btnGhost)}
              >
                Choose {props.kind}…
              </button>
            </>
          }
        >
          <span {...stylex.props(styles.tile)}>
            <FileTextIcon size={18} />
          </span>
          <div {...stylex.props(styles.info)}>
            <div {...stylex.props(styles.name)} title={resolveMediaUrl(current()!.url)}>
              {current()!.name || current()!.id.slice(0, 12)}
            </div>
            <div {...stylex.props(styles.sub)}>
              {[current()!.mime, current()!.size ? fileRefLabel(current()).size : ''].filter(Boolean).join(' · ') || props.kind}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(true)} {...stylex.props(s.btnGhost)}>
            Replace
          </button>
          <button type="button" onClick={() => props.onChange(null)} {...stylex.props(s.btnDanger)}>
            Remove
          </button>
        </Show>
      </div>

      <Show when={open()}>
        <FilePicker
          kind={props.kind}
          title={`Choose ${props.kind}`}
          onClose={() => setOpen(false)}
          onPick={(item) => {
            props.onChange(toFieldValue(item))
            setOpen(false)
          }}
        />
      </Show>
    </div>
  )
}