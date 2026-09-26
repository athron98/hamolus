import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Index, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { MediaUploadMeta } from '@hamolus/types'
import { api, type MediaVariantUpload } from '../lib/api'
import { logActivity } from '../lib/activity'
import { makeThumb, toWebp } from '../lib/image'
import { s, tokens } from '../theme.stylex'
import { ResizeDialog, type CropResult } from './ResizeDialog'
import { FocusDialog } from './FocusDialog'
import { TagInput } from './TagInput'
import { CropIcon, CrosshairIcon, UploadIcon, XIcon } from './Icons'

const MAX_FILES = 20

/** A single mouse-ready output derived from one uploaded image. */
export interface UploadOutput extends CropResult {
  id: string
}

interface UploadItem {
  id: string
  file: File
  url: string
  width: number | null
  height: number | null
  name: string
  title: string
  alt: string
  description: string
  caption: string
  group: string
  category: string
  tags: string[]
  focusX: number
  focusY: number
  /** Cropped/resized variants. Outputs[0] becomes the default asset; the rest upload as variants. */
  outputs: UploadOutput[]
  busy: boolean
  error: string | null
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
    maxWidth: 820,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadow,
    borderRadius: tokens.radius,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '22px 16px',
    borderRadius: tokens.radius,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    cursor: 'pointer',
    color: tokens.textDim,
    borderStyle: 'none',
    transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease',
  },
  dropActive: {
    boxShadow: tokens.shadowInputFocus,
    color: tokens.accent,
  },
  dropTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
  },
  dropHint: {
    fontSize: 12,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: '52vh',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    gap: 14,
    padding: 12,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
  },
  itemPreview: {
    flexShrink: 0,
    width: 168,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  previewBtn: {
    position: 'relative',
    display: 'block',
    width: '100%',
    aspectRatio: '4 / 3',
    padding: 0,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': { boxShadow: tokens.shadowInputFocus },
    ':focus-visible': { boxShadow: tokens.shadowInputFocus },
  },
  previewImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewHint: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontSize: 11.5,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    ':hover': { opacity: 1 },
  },
  outputBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  outputBadge: {
    padding: '2px 7px',
    fontSize: 10.5,
    fontWeight: 700,
    color: tokens.accent,
    backgroundColor: tokens.surfaceDeep,
    borderRadius: tokens.radiusSm,
    boxShadow: `0 0 0 1px ${tokens.accentSoft}`,
    whiteSpace: 'nowrap',
  },
  actionRow: {
    display: 'flex',
    gap: 6,
  },
  itemStatus: {
    fontSize: 11,
    color: tokens.textDim,
  },
  itemFields: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  progress: {
    flex: 1,
    fontSize: 12,
    color: tokens.textDim,
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: tokens.textDim,
    cursor: 'pointer',
    borderRadius: tokens.radiusSm,
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': { color: tokens.danger, backgroundColor: tokens.dangerSoft },
  },
  smallBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '3px 9px',
    fontSize: 11.5,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
    ':hover': { color: tokens.accent, backgroundColor: tokens.accentSoft, transform: 'translateY(-1px)' },
  },
  error: { color: tokens.danger, fontSize: 12 },
})

async function fileDims(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bmp = await createImageBitmap(file)
    const dims = { width: bmp.width, height: bmp.height }
    bmp.close()
    return dims
  } catch {
    return { width: null, height: null }
  }
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const FULL_RECT = { x: 0, y: 0, w: 0, h: 0 }

function newItem(file: File, width: number | null, height: number | null): UploadItem {
  const dims = { w: width ?? 0, h: height ?? 0 }
  return {
    id: randomId(),
    file,
    url: URL.createObjectURL(file),
    width,
    height,
    name: file.name,
    title: '',
    alt: '',
    description: '',
    caption: '',
    group: '',
    category: '',
    tags: [],
    focusX: 50,
    focusY: 50,
    outputs: [
      {
        id: randomId(),
        file,
        width: width ?? 0,
        height: height ?? 0,
        label: 'Original',
        srcX: 0,
        srcY: 0,
        srcW: dims.w,
        srcH: dims.h,
        focusX: 50,
        focusY: 50,
      },
    ],
    busy: false,
    error: null,
  }
}

const focusPct = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10))

export function UploadModal(props: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const taxonomy = createQuery(() => ({
    queryKey: ['media-taxonomy'],
    queryFn: () => api.getMediaTaxonomy().then((r) => r.data),
  }))

  const [items, setItems] = createSignal<UploadItem[]>([])
  const [over, setOver] = createSignal(false)
  const [uploading, setUploading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [resizeId, setResizeId] = createSignal<string | null>(null)
  const [focusId, setFocusId] = createSignal<string | null>(null)

  const resizeItem = () => items().find((it) => it.id === resizeId()) ?? null
  const focusItem = () => items().find((it) => it.id === focusId()) ?? null

  const addFiles = async (fileList: FileList | null | undefined) => {
    if (!fileList) return
    setError(null)
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) {
      setError('Only image files can be uploaded.')
      return
    }
    const room = MAX_FILES - items().length
    const toAdd = files.slice(0, Math.max(0, room))
    if (toAdd.length < files.length) setError(`Only ${MAX_FILES} images at a time.`)
    const prepared = await Promise.all(
      toAdd.map(async (f) => {
        const dims = await fileDims(f)
        return newItem(f, dims.width, dims.height)
      }),
    )
    setItems((prev) => [...prev, ...prepared])
  }

  const update = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const remove = (id: string) => {
    const it = items().find((x) => x.id === id)
    if (it) URL.revokeObjectURL(it.url)
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  const applyCrops = (id: string, results: CropResult[]) => {
    const it = items().find((x) => x.id === id)
    if (!it) return
    const outputs: UploadOutput[] = results.map((r) => ({
      id: randomId(),
      file: r.file,
      width: r.width,
      height: r.height,
      label: r.label,
      srcX: r.srcX,
      srcY: r.srcY,
      srcW: r.srcW,
      srcH: r.srcH,
      focusX: r.focusX,
      focusY: r.focusY,
    }))
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, outputs } : x)))
    setResizeId(null)
  }

  const pendingCount = () => items().filter((it) => !it.error && !it.busy).length
  const finishedCount = () => items().filter((it) => it.error !== null).length

  const uploadItem = async (it: UploadItem): Promise<void> => {
    update(it.id, { busy: true, error: null })
    try {
      const base = it.name.trim() || it.file.name
      const [first, ...rest] = it.outputs
      if (!first) throw new Error('No outputs to upload')

      let def = first
      if (def.file.type !== 'image/webp') {
        const processed = await toWebp(def.file, base)
        def = { ...def, file: processed.file, width: processed.width, height: processed.height }
      }
      const thumb = await makeThumb(def.file, base)

      const variants: MediaVariantUpload[] = []
      for (const out of rest) {
        let vfile = out.file
        if (vfile.type !== 'image/webp') {
          const processed = await toWebp(vfile, base)
          vfile = processed.file
        }
        variants.push({ file: vfile, label: out.label, focusX: focusPct(out.focusX), focusY: focusPct(out.focusY) })
      }

      const untouched = it.outputs.length === 1 && it.outputs[0].label === 'Original'
      const fx = untouched ? focusPct(it.focusX) : focusPct(def.focusX)
      const fy = untouched ? focusPct(it.focusY) : focusPct(def.focusY)
      const meta: MediaUploadMeta = {
        name: base,
        title: it.title.trim() || null,
        alt: it.alt.trim() || null,
        description: it.description.trim() || null,
        caption: it.caption.trim() || null,
        group: it.group.trim() || null,
        category: it.category.trim() || null,
        tags: it.tags.length > 0 ? it.tags : null,
        focusX: fx,
        focusY: fy,
      }

      await api.uploadMedia(def.file, meta, thumb, variants)
      const n = variants.length
      logActivity(
        'media.upload',
        'Uploaded media',
        n > 0 ? `${base} + ${n} ${n === 1 ? 'variant' : 'variants'}` : base,
      )
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-taxonomy'] })
      queryClient.invalidateQueries({ queryKey: ['media-taxonomy-detail'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      remove(it.id)
    } catch (err) {
      update(it.id, { busy: false, error: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  const uploadAll = async () => {
    setUploading(true)
    setError(null)
    const queue = items()
    for (const it of queue) {
      if (items().find((x) => x.id === it.id) && !it.error && !it.busy) await uploadItem(it)
    }
    setUploading(false)
    if (items().length === 0) props.onClose()
  }

  const groups = () => taxonomy.data?.groups ?? []
  const categories = () => taxonomy.data?.categories ?? []

  return (
    <div {...stylex.props(styles.overlay)} onClick={() => !uploading() && props.onClose()}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <Show when={resizeItem()}>
          <ResizeDialog
            file={resizeItem()!.file}
            url={resizeItem()!.url}
            width={resizeItem()!.width}
            height={resizeItem()!.height}
            sourceFocusX={resizeItem()!.focusX}
            sourceFocusY={resizeItem()!.focusY}
            onApply={(results) => applyCrops(resizeItem()!.id, results)}
            onClose={() => setResizeId(null)}
          />
        </Show>

        <Show when={focusItem()}>
          <FocusDialog
            url={focusItem()!.url}
            x={focusItem()!.focusX}
            y={focusItem()!.focusY}
            onSave={(x, y) => {
              update(focusItem()!.id, { focusX: x, focusY: y })
              setFocusId(null)
            }}
            onClose={() => setFocusId(null)}
          />
        </Show>

        <div {...stylex.props(styles.header)}>
          <div>
            <h2 {...stylex.props(s.heading)}>Upload media</h2>
            <p {...stylex.props(s.subheading)}>
              Drop images, then crop to several aspect ratios, set a focus point, and upload. Uploads are converted to WebP.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            disabled={uploading()}
            onClick={props.onClose}
            {...stylex.props(s.btnIcon)}
          >
            <XIcon size={15} />
          </button>
        </div>

        <label
          {...stylex.props(styles.dropzone, over() && styles.dropActive)}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            addFiles(e.dataTransfer?.files)
          }}
        >
          <UploadIcon size={22} />
          <span {...stylex.props(styles.dropTitle)}>Drop images here or click to browse</span>
          <span {...stylex.props(styles.dropHint)}>
            PNG · JPEG · WebP · GIF · SVG · AVIF — drop more at any time
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.currentTarget.files)}
          />
        </label>

        <Show when={error()}>
          <p {...stylex.props(s.error)}>{error()}</p>
        </Show>

        <Show when={items().length > 0}>
          <div {...stylex.props(styles.list)}>
            <Index each={items()}>
              {(it) => (
                <div {...stylex.props(styles.item)}>
                  <div {...stylex.props(styles.itemPreview)}>
                    <button
                      type="button"
                      title="Crop & resize"
                      aria-label="Crop and resize image"
                      onClick={() => setResizeId(it().id)}
                      {...stylex.props(styles.previewBtn)}
                    >
                      <img src={it().url} alt="" loading="lazy" {...stylex.props(styles.previewImg)} />
                      <span {...stylex.props(styles.previewHint)}>
                        <CropIcon size={14} />
                        Crop & resize
                      </span>
                    </button>
                    <div {...stylex.props(styles.actionRow)}>
                      <button
                        type="button"
                        title="Set the focus point for thumbnails"
                        aria-label="Set focus point"
                        onClick={() => setFocusId(it().id)}
                        {...stylex.props(styles.smallBtn)}
                      >
                        <CrosshairIcon size={12} />
                        Focus
                      </button>
                      <button
                        type="button"
                        title="Crop & resize to several aspect ratios"
                        aria-label="Crop and resize"
                        onClick={() => setResizeId(it().id)}
                        {...stylex.props(styles.smallBtn)}
                      >
                        <CropIcon size={12} />
                        Crop
                      </button>
                    </div>
                    <div {...stylex.props(styles.outputBadges)}>
                      <For each={it().outputs}>
                        {(o) => <span {...stylex.props(styles.outputBadge)}>{o.label}</span>}
                      </For>
                    </div>
                    <span {...stylex.props(styles.itemStatus)}>
                      Focus {Math.round(it().focusX)}%, {Math.round(it().focusY)}%
                    </span>
                  </div>

                  <div {...stylex.props(styles.itemFields)}>
                    <div {...stylex.props(styles.itemHeader)}>
                      <div style={{ flex: 1 }}>
                        <label {...stylex.props(s.label)} for={`name-${it().id}`}>Name</label>
                        <input
                          id={`name-${it().id}`}
                          type="text"
                          value={it().name}
                          onInput={(e) => update(it().id, { name: e.currentTarget.value })}
                          {...stylex.props(s.input)}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label="Remove image"
                        title="Remove image"
                        onClick={() => remove(it().id)}
                        {...stylex.props(styles.removeBtn)}
                      >
                        <XIcon size={13} />
                      </button>
                    </div>
                    <div {...stylex.props(styles.fieldRow)}>
                      <div>
                        <label {...stylex.props(s.label)} for={`group-${it().id}`}>Group</label>
                        <input
                          id={`group-${it().id}`}
                          type="text"
                          list="upload-groups"
                          value={it().group}
                          onInput={(e) => update(it().id, { group: e.currentTarget.value })}
                          placeholder="e.g. Homepage"
                          {...stylex.props(s.input)}
                        />
                      </div>
                      <div>
                        <label {...stylex.props(s.label)} for={`category-${it().id}`}>Category</label>
                        <input
                          id={`category-${it().id}`}
                          type="text"
                          list="upload-categories"
                          value={it().category}
                          onInput={(e) => update(it().id, { category: e.currentTarget.value })}
                          placeholder="e.g. Photo"
                          {...stylex.props(s.input)}
                        />
                      </div>
                    </div>
                    <div>
                      <label {...stylex.props(s.label)}>Tags</label>
                      <TagInput
                        value={() => it().tags}
                        onChange={(t) => update(it().id, { tags: t })}
                        suggestions={() => taxonomy.data?.tags ?? []}
                      />
                    </div>
                    <div>
                      <label {...stylex.props(s.label)} for={`title-${it().id}`}>SEO title</label>
                      <input
                        id={`title-${it().id}`}
                        type="text"
                        value={it().title}
                        onInput={(e) => update(it().id, { title: e.currentTarget.value })}
                        {...stylex.props(s.input)}
                      />
                    </div>
                    <div>
                      <label {...stylex.props(s.label)} for={`caption-${it().id}`}>Caption</label>
                      <input
                        id={`caption-${it().id}`}
                        type="text"
                        value={it().caption}
                        onInput={(e) => update(it().id, { caption: e.currentTarget.value })}
                        placeholder="Shown in the media viewer"
                        {...stylex.props(s.input)}
                      />
                    </div>
                    <div {...stylex.props(styles.fieldRow)}>
                      <div>
                        <label {...stylex.props(s.label)} for={`alt-${it().id}`}>Alt text</label>
                        <input
                          id={`alt-${it().id}`}
                          type="text"
                          value={it().alt}
                          onInput={(e) => update(it().id, { alt: e.currentTarget.value })}
                          {...stylex.props(s.input)}
                        />
                      </div>
                      <div>
                        <label {...stylex.props(s.label)} for={`desc-${it().id}`}>Description</label>
                        <input
                          id={`desc-${it().id}`}
                          type="text"
                          value={it().description}
                          onInput={(e) => update(it().id, { description: e.currentTarget.value })}
                          {...stylex.props(s.input)}
                        />
                      </div>
                    </div>
                    <Show when={it().error}>
                      <p {...stylex.props(styles.error)}>{it().error}</p>
                    </Show>
                  </div>
                </div>
              )}
            </Index>
          </div>
          <datalist id="upload-groups">
            <For each={groups()}>{(g) => <option value={g} />}</For>
          </datalist>
          <datalist id="upload-categories">
            <For each={categories()}>{(c) => <option value={c} />}</For>
          </datalist>
        </Show>

        <div {...stylex.props(styles.actionBar)}>
          <span {...stylex.props(styles.progress)}>
            <Show when={uploading()}>Uploading… </Show>
            {items().length} ready · {finishedCount()} failed
          </span>
          <button type="button" onClick={props.onClose} disabled={uploading()} {...stylex.props(s.btnGhost)}>
            Cancel
          </button>
          <button
            type="button"
            onClick={uploadAll}
            disabled={uploading() || items().length === 0}
            {...stylex.props(s.btn)}
          >
            <UploadIcon size={15} />
            {uploading() ? 'Uploading…' : `Upload ${pendingCount()} ${pendingCount() === 1 ? 'image' : 'images'}`}
          </button>
        </div>
      </div>
    </div>
  )
}