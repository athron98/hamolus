import { createQuery } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { createMutation, useQueryClient } from '@tanstack/solid-query'
import type { MediaObject, MediaUpdate } from '@hamolus/types'
import { api } from '../lib/api'
import { logActivity } from '../lib/activity'
import { makeThumb, toWebp } from '../lib/image'
import { resolveMediaUrl } from '../lib/media'
import { s, tokens } from '../theme.stylex'
import { FocusPicker } from './FocusPicker'
import { TagInput } from './TagInput'
import { ExternalLinkIcon, XIcon } from './Icons'

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
    maxWidth: 600,
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
  previewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 84,
    height: 84,
    borderRadius: tokens.radiusSm,
    objectFit: 'cover',
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
  },
  dims: {
    fontSize: 12,
    color: tokens.textDim,
  },
  hint: {
    fontSize: 12,
    color: tokens.textDim,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
})

/** Downscale a media asset's bytes to a target width as WebP (keeps aspect ratio). */
async function resizeImage(item: MediaObject, maxWidth: number): Promise<File | null> {
  const res = await fetch(item.url)
  const blob = await res.blob()
  const bmp = await createImageBitmap(blob)
  try {
    if (bmp.width <= maxWidth) return null
    const height = Math.max(1, Math.round((bmp.height / bmp.width) * maxWidth))
    const canvas = document.createElement('canvas')
    canvas.width = maxWidth
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, maxWidth, height)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92))
    if (!out) return null
    const base = item.name.replace(/\.[^.]+$/, '')
    return new File([out], `${base}.webp`, { type: 'image/webp' })
  } finally {
    bmp.close()
  }
}

export function MediaEditor(props: { item: MediaObject; onClose: () => void }) {
  const queryClient = useQueryClient()
  const taxonomy = createQuery(() => ({
    queryKey: ['media-taxonomy'],
    queryFn: () => api.getMediaTaxonomy().then((r) => r.data),
  }))

  const [name, setName] = createSignal(props.item.name)
  const [title, setTitle] = createSignal(props.item.title ?? '')
  const [alt, setAlt] = createSignal(props.item.alt ?? '')
  const [caption, setCaption] = createSignal(props.item.caption ?? '')
  const [description, setDescription] = createSignal(props.item.description ?? '')
  const [group, setGroup] = createSignal(props.item.group ?? '')
  const [category, setCategory] = createSignal(props.item.category ?? '')
  const [tags, setTags] = createSignal<string[]>(props.item.tags)
  const [focusX, setFocusX] = createSignal(props.item.focusX ?? 50)
  const [focusY, setFocusY] = createSignal(props.item.focusY ?? 50)
  const [targetWidth, setTargetWidth] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [notice, setNotice] = createSignal<string | null>(null)

  const hasDims = () => props.item.width && props.item.height

  const previewStyle = (): Record<string, string> => ({
    'object-position': `${focusX()}% ${focusY()}%`,
  })

  const save = createMutation(() => ({
    mutationFn: async () => {
      const patch: MediaUpdate = {
        name: name().trim(),
        title: title().trim() || null,
        alt: alt().trim() || null,
        caption: caption().trim() || null,
        description: description().trim() || null,
        group: group().trim() || null,
        category: category().trim() || null,
        tags: tags().length > 0 ? tags() : null,
        focusX: Math.round(focusX() * 10) / 10,
        focusY: Math.round(focusY() * 10) / 10,
      }
      const width = parseInt(targetWidth(), 10)
      if (width && width > 0 && hasDims()) {
        const resized = await resizeImage(props.item, width)
        if (resized) {
          const thumb = await makeThumb(resized, props.item.name.replace(/\.[^.]+$/, ''))
          await api.replaceMedia(props.item.id, resized, thumb)
        } else {
          setNotice('Image is already narrower than the requested width — no resize needed.')
        }
      }
      await api.updateMedia(props.item.id, patch)
    },
    onSuccess: () => {
      logActivity('media.update', 'Updated media', props.item.name)
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-taxonomy'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      props.onClose()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Save failed')
    },
  }))

  return (
    <div {...stylex.props(styles.overlay)} onClick={props.onClose}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <h2 {...stylex.props(s.heading)}>Edit media</h2>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onClose}
            {...stylex.props(s.btnIcon)}
          >
            <XIcon size={15} />
          </button>
        </div>

        <div {...stylex.props(styles.previewRow)}>
          <img src={resolveMediaUrl(props.item.thumbUrl ?? props.item.url)} alt="" style={previewStyle()} {...stylex.props(styles.preview)} />
          <div>
            <div {...stylex.props(styles.dims)}>
              {props.item.mime} · {props.item.size} bytes
            </div>
            <div {...stylex.props(styles.dims)}>
              {hasDims() ? `${props.item.width} × ${props.item.height} px` : 'Dimensions unknown'}
            </div>
            <div {...stylex.props(styles.dims)}>
              Focus: {Math.round(focusX())}%, {Math.round(focusY())}%
            </div>
          </div>
        </div>

        <div>
          <label {...stylex.props(s.label)}>Focus point — controls how the image is cropped in previews</label>
          <FocusPicker
            imageUrl={props.item.url}
            x={focusX()}
            y={focusY()}
            onChange={(x, y) => {
              setFocusX(x)
              setFocusY(y)
            }}
          />
          <button
            type="button"
            onClick={() => {
              setFocusX(50)
              setFocusY(50)
            }}
            {...stylex.props(s.btn, s.btnGhost)}
          >
            Reset to center
          </button>
        </div>

<div>
          <label {...stylex.props(s.label)} for="media-alt">Alt text (accessibility / SEO)</label>
          <input
            id="media-alt"
            type="text"
            value={alt()}
            onInput={(e) => setAlt(e.currentTarget.value)}
            {...stylex.props(s.input)}
          />
        </div>

        <div>
          <label {...stylex.props(s.label)} for="media-caption">Caption</label>
          <input
            id="media-caption"
            type="text"
            value={caption()}
            onInput={(e) => setCaption(e.currentTarget.value)}
            placeholder="Shown in the media viewer"
            {...stylex.props(s.input)}
          />
        </div>

        <div>
          <label {...stylex.props(s.label)} for="media-title">SEO title</label>
          <input
            id="media-title"
            type="text"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            placeholder="Short, descriptive title"
            {...stylex.props(s.input)}
          />
        </div>

        <div>
          <label {...stylex.props(s.label)} for="media-desc">Description</label>
          <textarea
            id="media-desc"
            rows={3}
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="Optional caption or context"
            {...stylex.props(s.textarea)}
          />
        </div>

        <div>
          <label {...stylex.props(s.label)} for="media-group">Group</label>
          <input
            id="media-group"
            type="text"
            list="media-groups"
            value={group()}
            onInput={(e) => setGroup(e.currentTarget.value)}
            placeholder="e.g. Homepage, Products…"
            {...stylex.props(s.input)}
          />
          <datalist id="media-groups">
            <For each={taxonomy.data?.groups ?? []}>
              {(g) => <option value={g} />}
            </For>
          </datalist>
        </div>

        <div>
          <label {...stylex.props(s.label)} for="media-category">Category</label>
          <input
            id="media-category"
            type="text"
            list="media-categories"
            value={category()}
            onInput={(e) => setCategory(e.currentTarget.value)}
            placeholder="e.g. Photography, Illustration…"
            {...stylex.props(s.input)}
          />
          <datalist id="media-categories">
            <For each={taxonomy.data?.categories ?? []}>
              {(c) => <option value={c} />}
            </For>
          </datalist>
        </div>

        <div>
          <label {...stylex.props(s.label)}>Tags</label>
          <TagInput
            value={tags}
            onChange={(next) => setTags(next)}
            suggestions={() => taxonomy.data?.tags ?? []}
          />
        </div>

        <div>
          <label {...stylex.props(s.label)} for="media-width">Resize to width (px)</label>
          <input
            id="media-width"
            type="number"
            min={1}
            max={hasDims() ? props.item.width! : undefined}
            placeholder={hasDims() ? `Current: ${props.item.width}px` : 'Dimensions unknown'}
            disabled={!hasDims()}
            value={targetWidth()}
            onInput={(e) => setTargetWidth(e.currentTarget.value)}
            {...stylex.props(s.input)}
          />
          <p {...stylex.props(styles.hint)}>
            Keeps aspect ratio; only downsizes (replaces the stored file with a WebP version, same URL).
          </p>
        </div>

        <Show when={notice()}>
          <p {...stylex.props(s.muted)}>{notice()}</p>
        </Show>
        <Show when={error()}>
          <p {...stylex.props(s.error)}>{error()}</p>
        </Show>

        <div {...stylex.props(styles.footer)}>
          <button type="button" onClick={props.onClose} disabled={save.isPending} {...stylex.props(s.btnGhost)}>
            Cancel
          </button>
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} {...stylex.props(s.btn)}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}