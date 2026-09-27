/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Index, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { api, type FileKind } from '../lib/api'
import { fileKindMeta, formatBytes } from '../lib/files'
import { logActivity } from '../lib/activity'
import { s, tokens } from '../theme.stylex'
import { TagInput } from './TagInput'
import { FileTextIcon, TrashIcon, UploadIcon, XIcon } from './Icons'

interface PendingFile {
  file: File
  name: string
}

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    overflowY: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadow,
    borderRadius: tokens.radius,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  drop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '22px 16px',
    width: '100%',
    backgroundColor: tokens.surfaceRaised,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    borderRadius: tokens.radiusSm,
    color: tokens.textDim,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.accentSoft, color: tokens.accent },
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 260,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 10px',
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '34px',
    flexShrink: 0,
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderRadius: tokens.radiusSm,
  },
  rowMain: {
    minWidth: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  rowName: {
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  rowMeta: {
    fontSize: 11,
    color: tokens.textDim,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  nameInput: {
    padding: '4px 8px',
    fontSize: 12,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': { boxShadow: tokens.shadowInputFocus },
  },
  shared: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
  },
  sharedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sharedLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    color: tokens.textDim,
    flexShrink: 0,
    minWidth: 96,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '6px 10px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': { boxShadow: tokens.shadowInputFocus },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  error: {
    fontSize: 12,
    color: tokens.danger,
  },
  count: {
    fontSize: 12,
    color: tokens.textDim,
  },
})

export function FileUploadModal(props: {
  kind: FileKind
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const kind = props.kind
  const noun = fileKindMeta(kind).noun

  const taxonomyQuery = createQuery(() => ({
    queryKey: ['files-taxonomy', kind] as const,
    queryFn: () => api.getFileTaxonomy(kind).then((r) => r.data),
  }))

  const [files, setFiles] = createSignal<PendingFile[]>([])
  const [title, setTitle] = createSignal('')
  const [description, setDescription] = createSignal('')
  const [group, setGroup] = createSignal('')
  const [category, setCategory] = createSignal('')
  const [tags, setTags] = createSignal<string[]>([])
  const [uploading, setUploading] = createSignal(false)
  const [index, setIndex] = createSignal(0)
  const [errors, setErrors] = createSignal<string[]>([])
  const [done, setDone] = createSignal(false)

  const groups = () => taxonomyQuery.data?.groups ?? []
  const categories = () => taxonomyQuery.data?.categories ?? []
  const tagOptions = () => taxonomyQuery.data?.tags ?? []

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next: PendingFile[] = []
    for (const f of Array.from(list)) {
      if (files().some((p) => p.file === f)) continue
      const cleaned = f.name.replace(/\.[a-zA-Z0-9]+$/, '')
      next.push({ file: f, name: cleaned })
    }
    setFiles((prev) => [...prev, ...next])
    setErrors([])
  }

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  const rename = (i: number, name: string) => {
    setFiles((prev) => prev.map((p, idx) => (idx === i ? { ...p, name } : p)))
  }

  const close = () => {
    if (!uploading()) props.onClose()
  }

  const uploadAll = async () => {
    const list = files()
    if (list.length === 0 || uploading()) return
    setUploading(true)
    setDone(false)
    setErrors([])
    const nextErrors: string[] = []
    const trimmedGroup = group().trim() || undefined
    const trimmedCategory = category().trim() || undefined
    const tagsTrimmed = tags().map((t) => t.trim()).filter(Boolean)
    for (let i = 0; i < list.length; i++) {
      setIndex(i)
      const p = list[i]
      const meta = {
        name: p.name.trim() || p.file.name,
        title: title().trim() || undefined,
        description: description().trim() || undefined,
        group: trimmedGroup,
        category: trimmedCategory,
        tags: tagsTrimmed,
      }
      try {
        await api.uploadFile(kind, p.file, meta)
        logActivity(`${kind}.upload`, meta.name)
      } catch (e) {
        nextErrors.push(`${p.file.name}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }
    setErrors(nextErrors)
    setUploading(false)
    setDone(true)
    queryClient.invalidateQueries({ queryKey: ['files', kind] })
    queryClient.invalidateQueries({ queryKey: ['files-taxonomy', kind] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    if (nextErrors.length === 0) {
      setTimeout(props.onClose, 600)
    } else {
      setFiles([])
    }
  }

  return (
    <div {...stylex.props(styles.overlay)} onClick={close}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <h2 {...stylex.props(s.heading)}>Upload {noun}s</h2>
          <button type="button" aria-label="Close" title="Close" onClick={close} {...stylex.props(s.btnIcon)}>
            <XIcon size={15} />
          </button>
        </div>

        <label {...stylex.props(styles.drop)}>
          <UploadIcon size={15} />
          Add {noun}s — drag & drop or click to browse
          <input
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              addFiles(e.currentTarget.files)
              e.currentTarget.value = ''
            }}
          />
        </label>

        <Show when={files().length > 0}>
          <div {...stylex.props(styles.list)}>
            <Index each={files()}>
              {(item, i) => (
                <div {...stylex.props(styles.row)}>
                  <span {...stylex.props(styles.tile)}>
                    <FileTextIcon size={16} />
                  </span>
                  <div {...stylex.props(styles.rowMain)}>
                    <span {...stylex.props(styles.rowMeta)}>
                      {item().file.type || 'unknown type'} · {formatBytes(item().file.size)}
                    </span>
                    <input
                      type="text"
                      value={item().name}
                      onInput={(e) => rename(i, e.currentTarget.value)}
                      {...stylex.props(styles.nameInput)}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={() => removeFile(i)}
                    disabled={uploading()}
                    {...stylex.props(s.btnIcon, s.btnIconDanger, s.btnIconSm)}
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              )}
            </Index>
          </div>
          <span {...stylex.props(styles.count)}>
            {files().length} file{files().length === 1 ? '' : 's'} selected
          </span>
        </Show>

        <Show when={files().length > 0}>
          <div {...stylex.props(styles.shared)}>
            <div {...stylex.props(styles.sharedRow)}>
              <span {...stylex.props(styles.sharedLabel)}>SEO title</span>
              <input type="text" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} {...stylex.props(styles.input)} />
            </div>
            <div {...stylex.props(styles.sharedRow)}>
              <span {...stylex.props(styles.sharedLabel)}>Description</span>
              <input type="text" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} {...stylex.props(styles.input)} />
            </div>
            <div {...stylex.props(styles.sharedRow)}>
              <span {...stylex.props(styles.sharedLabel)}>Group</span>
              <input
                type="text"
                list="file-groups"
                value={group()}
                onInput={(e) => setGroup(e.currentTarget.value)}
                {...stylex.props(styles.input)}
              />
              <datalist id="file-groups">
                <For each={groups()}>
                  {(g) => <option value={g} />}
                </For>
              </datalist>
            </div>
            <div {...stylex.props(styles.sharedRow)}>
              <span {...stylex.props(styles.sharedLabel)}>Category</span>
              <input
                type="text"
                list="file-categories"
                value={category()}
                onInput={(e) => setCategory(e.currentTarget.value)}
                {...stylex.props(styles.input)}
              />
              <datalist id="file-categories">
                <For each={categories()}>
                  {(c) => <option value={c} />}
                </For>
              </datalist>
            </div>
            <div {...stylex.props(styles.sharedRow)}>
              <span {...stylex.props(styles.sharedLabel)}>Tags</span>
              <div style={{ flex: 1, 'min-width': 0 }}>
                <TagInput
                  value={() => tags()}
                  onChange={(t) => setTags(t)}
                  suggestions={() => tagOptions()}
                />
              </div>
            </div>
          </div>
        </Show>

        <Show when={errors().length > 0}>
          <div {...stylex.props(styles.error)}>
            {errors().map((e) => (
              <div>✕ {e}</div>
            ))}
          </div>
        </Show>

        <div {...stylex.props(styles.footer)}>
          <span {...stylex.props(styles.count)}>
            {uploading() ? `Uploading ${index() + 1} / ${files().length}…` : done() ? 'Done.' : ''}
          </span>
          <div {...stylex.props(styles.footerActions)}>
            <button type="button" onClick={close} disabled={uploading()} {...stylex.props(s.btnGhost)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={uploadAll}
              disabled={files().length === 0 || uploading()}
              {...stylex.props(s.btn)}
            >
              {uploading() ? 'Uploading…' : `Upload ${files().length > 0 ? files().length : ''} ${noun}${files().length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}