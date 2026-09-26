import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { FileObject } from '@hamolus/types'
import { api, type FileKind } from '../lib/api'
import { fileKindMeta, formatBytes } from '../lib/files'
import { logActivity } from '../lib/activity'
import { resolveMediaUrl } from '../lib/media'
import { s, tokens } from '../theme.stylex'
import { TagInput } from './TagInput'
import { ExternalLinkIcon, FileTextIcon, XIcon } from './Icons'

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
    maxWidth: 560,
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
  preview: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '52px',
    height: '56px',
    flexShrink: 0,
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    borderRadius: tokens.radiusSm,
  },
  previewInfo: {
    minWidth: 0,
    flex: 1,
  },
  previewName: {
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  previewSub: {
    fontSize: 12,
    color: tokens.textDim,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    color: tokens.textDim,
  },
  input: {
    padding: '7px 12px',
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
  textarea: {
    padding: '7px 12px',
    fontSize: 13,
    lineHeight: 1.5,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    resize: 'vertical',
    minHeight: 60,
    transition: `box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)`,
    ':focus': { boxShadow: tokens.shadowInputFocus },
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  error: {
    fontSize: 12,
    color: tokens.danger,
  },
  status: {
    fontSize: 12,
    color: tokens.textDim,
    flex: 1,
  },
})

export function FileEditor(props: {
  kind: FileKind
  item: FileObject
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const kind = props.kind
  const meta = fileKindMeta(kind)

  const taxonomyQuery = createQuery(() => ({
    queryKey: ['files-taxonomy', kind] as const,
    queryFn: () => api.getFileTaxonomy(kind).then((r) => r.data),
  }))

  const [name, setName] = createSignal(props.item.name)
  const [title, setTitle] = createSignal(props.item.title ?? '')
  const [description, setDescription] = createSignal(props.item.description ?? '')
  const [group, setGroup] = createSignal(props.item.group ?? '')
  const [category, setCategory] = createSignal(props.item.category ?? '')
  const [tags, setTags] = createSignal<string[]>(props.item.tags)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [saved, setSaved] = createSignal<string | null>(null)

  const groups = () => taxonomyQuery.data?.groups ?? []
  const categories = () => taxonomyQuery.data?.categories ?? []
  const tagOptions = () => taxonomyQuery.data?.tags ?? []

  const normalizeTags = (t: string[]): string[] | null => (t.length ? t : null)

  const close = () => {
    if (!saving()) props.onClose()
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const trimmed = name().trim()
      if (!trimmed) {
        setError('Name cannot be empty.')
        setSaving(false)
        return
      }
      const patch = {
        name: trimmed,
        title: title().trim() || null,
        description: description().trim() || null,
        group: group().trim() || null,
        category: category().trim() || null,
        tags: normalizeTags(tags()),
      }
      await api.updateFile(kind, props.item.id, patch)
      logActivity(`${kind}.update`, `${meta.noun} ${props.item.name}`)
      queryClient.invalidateQueries({ queryKey: ['files', kind] })
      queryClient.invalidateQueries({ queryKey: ['files-taxonomy', kind] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setSaved(`Saved ${meta.noun}.`)
      setTimeout(close, 400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
      setSaving(false)
    }
  }

  return (
    <div {...stylex.props(styles.overlay)} onClick={close}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <h2 {...stylex.props(s.heading)}>Edit {meta.noun}</h2>
          <button type="button" aria-label="Close" title="Close" onClick={close} {...stylex.props(s.btnIcon)}>
            <XIcon size={15} />
          </button>
        </div>

        <div {...stylex.props(styles.preview)}>
          <span {...stylex.props(styles.tile)}>
            <FileTextIcon size={22} />
          </span>
          <div {...stylex.props(styles.previewInfo)}>
            <div {...stylex.props(styles.previewName)}>{props.item.name}</div>
            <div {...stylex.props(styles.previewSub)}>
              {props.item.mime} · {formatBytes(props.item.size)} · {props.item.ext}
            </div>
          </div>
          <button
            type="button"
            title="Open in new tab"
            aria-label="Open file"
            onClick={() => window.open(resolveMediaUrl(props.item.url), '_blank', 'noreferrer')}
            {...stylex.props(s.btnIcon)}
          >
            <ExternalLinkIcon size={14} />
          </button>
        </div>

        <div {...stylex.props(styles.field)}>
          <label {...stylex.props(styles.label)}>Name</label>
          <input type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} {...stylex.props(styles.input)} />
        </div>
        <div {...stylex.props(styles.field)}>
          <label {...stylex.props(styles.label)}>SEO title</label>
          <input type="text" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} {...stylex.props(styles.input)} />
        </div>
        <div {...stylex.props(styles.field)}>
          <label {...stylex.props(styles.label)}>Description</label>
          <textarea value={description()} onInput={(e) => setDescription(e.currentTarget.value)} {...stylex.props(styles.textarea)} />
        </div>
        <div {...stylex.props(styles.field)}>
          <label {...stylex.props(styles.label)}>Group</label>
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
        <div {...stylex.props(styles.field)}>
          <label {...stylex.props(styles.label)}>Category</label>
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
        <div {...stylex.props(styles.field)}>
          <label {...stylex.props(styles.label)}>Tags</label>
          <TagInput
            value={() => tags()}
            onChange={(t) => setTags(t)}
            suggestions={() => tagOptions()}
          />
        </div>

        <div {...stylex.props(styles.footer)}>
          <span {...stylex.props(styles.status)}>{saved()}</span>
          <Show when={error()}>
            <span {...stylex.props(styles.error)}>{error()}</span>
          </Show>
          <button type="button" onClick={close} {...stylex.props(s.btnGhost)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving()}
            onClick={save}
            {...stylex.props(s.btn)}
          >
            {saving() ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}