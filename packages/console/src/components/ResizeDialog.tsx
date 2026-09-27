/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { PlusIcon, XIcon } from './Icons'

/**
 * One cropped output produced by the resize dialog. `file` is the encoded
 * image, `width`/`height` its pixel dimensions and `label` a human
 * description (ratio · output size). `src{OriginX,OriginY,Width,Height}`
 * describe the source-image region the crop draws from (in source pixels).
 * `focusX`/`focusY` are the focus point as percent of this variant's own
 * frame (each crop carries its own focus point, see the on-canvas marker).
 */
export interface CropResult {
  file: File
  width: number
  height: number
  label: string
  srcX: number
  srcY: number
  srcW: number
  srcH: number
  /** Focus point within the variant frame, percent (0–100). */
  focusX: number
  focusY: number
}

interface CropSpec {
  id: string
  ratioMode: 'free' | 'preset' | 'custom'
  presetId: string | null
  customW: number | null
  customH: number | null
  sizeId: string
  /** Crop rectangle in source pixels. */
  rect: { x: number; y: number; w: number; h: number }
  /** Focus point within this crop's frame, percent (0–100). */
  focusX: number
  focusY: number
}

const RATIOS: { id: string; label: string; value: number }[] = [
  { id: '2:1', label: '2:1', value: 2 },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '3:2', label: '3:2', value: 3 / 2 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '2:3', label: '2:3', value: 2 / 3 },
  { id: '9:16', label: '9:16', value: 9 / 16 },
]

const SIZES: { id: string; label: string; value: number }[] = [
  { id: 'original', label: 'Original', value: 0 },
  { id: '320', label: '320', value: 320 },
  { id: '640', label: '640', value: 640 },
  { id: '1024', label: '1024', value: 1024 },
  { id: '1280', label: '1280', value: 1280 },
  { id: '1600', label: '1600', value: 1600 },
]

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  return 'crop-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 70,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    overflowY: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 660,
    backgroundColor: tokens.surface,
    boxShadow: tokens.shadow,
    borderRadius: tokens.radius,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stage: {
    display: 'flex',
    justifyContent: 'center',
  },
  previewShell: {
    position: 'relative',
    borderRadius: tokens.radiusSm,
    overflow: 'hidden',
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    cursor: 'crosshair',
    touchAction: 'none',
    userSelect: 'none',
  },
  previewImg: {
    display: 'block',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  cropBox: {
    position: 'absolute',
    boxShadow: `0 0 0 1px rgba(255,255,255,0.95), 0 0 0 9999px rgba(0,0,0,0.5)`,
    pointerEvents: 'none',
  },
  thirdsH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  thirdsV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  handle: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 12,
    height: 12,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.accent,
    boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)',
    cursor: 'nwse-resize',
    pointerEvents: 'auto',
  },
  focusMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto',
    cursor: 'crosshair',
    touchAction: 'none',
  },
  markerRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: `1.5px solid ${tokens.accent}`,
    boxShadow: '0 0 0 1px rgba(255,255,255,0.9), 0 0 8px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
  },
  markerH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: tokens.accent,
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  markerV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: tokens.accent,
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
  },
  cropsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  cropChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    fontSize: 12.5,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
    ':hover': { color: tokens.text, transform: 'translateY(-1px)' },
  },
  chipActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  chipRemove: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    padding: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    color: 'inherit',
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'background-color 0.15s ease, color 0.15s ease',
    ':hover': { color: tokens.danger, backgroundColor: tokens.dangerSoft },
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    padding: '5px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    color: tokens.textDim,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    cursor: 'pointer',
    transition: 'color 0.15s ease, background-color 0.15s ease, transform 0.15s ease',
    ':hover': { color: tokens.text, transform: 'translateY(-1px)' },
  },
  segWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  customInputs: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  customNum: {
    width: 72,
    padding: '6px 10px',
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
  },
  ratioSep: {
    color: tokens.textDim,
    fontSize: 13,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    color: tokens.textDim,
    flexWrap: 'wrap',
  },
  kbd: {
    fontFamily: tokens.fontMono,
    fontSize: 11.5,
    color: tokens.text,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center',
  },
  error: { color: tokens.danger, fontSize: 12.5 },
})

export function ResizeDialog(props: {
  file: File
  url: string
  width: number | null
  height: number | null
  /** Focus point of the source image, percent (0–100) — seeded into crop frames. */
  sourceFocusX?: number
  sourceFocusY?: number
  onApply: (results: CropResult[]) => void
  onClose: () => void
}) {
  const [bitmap, setBitmap] = createSignal<ImageBitmap | null>(null)
  const [loadError, setLoadError] = createSignal(false)
  const [crops, setCrops] = createSignal<CropSpec[]>([])
  const [activeId, setActiveId] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  let shell: HTMLDivElement | undefined
  let cont: HTMLDivElement | undefined
  let drag:
    | { type: 'move' | 'resize'; startX: number; startY: number; rect: { x: number; y: number; w: number; h: number } }
    | { type: 'focus'; startX: number; startY: number; rect: { x: number; y: number; w: number; h: number } }
    | null = null

  const sourceFocus = () => ({
    x: clamp(props.sourceFocusX ?? 50, 0, 100),
    y: clamp(props.sourceFocusY ?? 50, 0, 100),
  })

  /** Map a source-image focus (percent) into a crop frame (percent of the rect). */
  const remapToFrame = (rect: { x: number; y: number; w: number; h: number }, w: number, h: number) => {
    if (rect.w <= 0 || rect.h <= 0) return { focusX: 50, focusY: 50 }
    const sx = (sourceFocus().x / 100) * w
    const sy = (sourceFocus().y / 100) * h
    return {
      focusX: clamp(((sx - rect.x) / rect.w) * 100, 0, 100),
      focusY: clamp(((sy - rect.y) / rect.h) * 100, 0, 100),
    }
  }

  onMount(async () => {
    try {
      const bmp = await createImageBitmap(props.file)
      setBitmap(bmp)
      const rect = { x: 0, y: 0, w: bmp.width, h: bmp.height }
      const spec: CropSpec = {
        id: randomId(),
        ratioMode: 'free',
        presetId: null,
        customW: null,
        customH: null,
        sizeId: 'original',
        rect,
        ...remapToFrame(rect, bmp.width, bmp.height),
      }
      setCrops([spec])
      setActiveId(spec.id)
    } catch {
      setLoadError(true)
    }
  })

  const bw = () => bitmap()?.width ?? props.width ?? 0
  const bh = () => bitmap()?.height ?? props.height ?? 0
  const dimsOk = () => bw() > 0 && bh() > 0

  const active = () => crops().find((c) => c.id === activeId()) ?? null

  const ratioOf = (spec: CropSpec): number | null => {
    if (spec.ratioMode === 'preset') {
      return RATIOS.find((r) => r.id === spec.presetId)?.value ?? null
    }
    if (spec.ratioMode === 'custom') {
      if (spec.customW && spec.customH) return spec.customW / spec.customH
      return null
    }
    return spec.rect.h > 0 ? spec.rect.w / spec.rect.h : null
  }

  const ratioLabel = (spec: CropSpec): string => {
    if (spec.ratioMode === 'preset') {
      return RATIOS.find((r) => r.id === spec.presetId)?.label ?? 'Crop'
    }
    if (spec.ratioMode === 'custom') {
      return spec.customW && spec.customH ? `${spec.customW}:${spec.customH}` : 'Custom'
    }
    return 'Free'
  }

  const setActiveSpec = (patch: Partial<CropSpec>) => {
    setCrops((prev) => prev.map((c) => (c.id === activeId() ? { ...c, ...patch } : c)))
  }

  const patchRect = (patch: Partial<{ x: number; y: number; w: number; h: number }>) => {
    const a = active()
    if (!a) return
    const w = bw()
    const h = bh()
    const r = { ...a.rect, ...patch }
    r.w = clamp(r.w, 8, w)
    r.h = clamp(r.h, 8, h)
    r.x = clamp(r.x, 0, w - r.w)
    r.y = clamp(r.y, 0, h - r.h)
    setActiveSpec({ rect: r })
  }

  /** Re-fit the active crop to a ratio, centering the previous window. */
  const setRatio = (mode: 'free' | 'preset' | 'custom', presetId?: string | null, customW?: number | null, customH?: number | null) => {
    const a = active()
    const w = bw()
    const h = bh()
    if (!a || !dimsOk()) return
    if (mode === 'free') {
      setActiveSpec({ ratioMode: mode, presetId: null, customW: null, customH: null })
      return
    }
    let ratio = 1
    if (mode === 'preset') ratio = RATIOS.find((r) => r.id === presetId)?.value ?? 1
    if (mode === 'custom') ratio = customW && customH ? customW / customH : 1
    let cw: number
    let ch: number
    if (w / h >= ratio) {
      ch = h * 0.96
      cw = ch * ratio
    } else {
      cw = w * 0.96
      ch = cw / ratio
    }
    const cx = a.rect.x + a.rect.w / 2
    const cy = a.rect.y + a.rect.h / 2
    const x = clamp(cx - cw / 2, 0, w - cw)
    const y = clamp(cy - ch / 2, 0, h - ch)
    setActiveSpec({ ratioMode: mode, presetId: mode === 'preset' ? presetId : null, customW: mode === 'custom' ? customW : null, customH: mode === 'custom' ? customH : null, rect: { x, y, w: cw, h: ch } })
  }

  const outDims = (spec: CropSpec) => {
    const r = spec.rect
    if (r.w <= 0 || r.h <= 0) return null
    const target = SIZES.find((z) => z.id === spec.sizeId)?.value ?? 0
    const scale = target > 0 ? Math.min(1, target / Math.max(r.w, r.h)) : 1
    return { w: Math.max(1, Math.round(r.w * scale)), h: Math.max(1, Math.round(r.h * scale)) }
  }

  const over = (spec: CropSpec | null) => {
    const w = bw()
    const h = bh()
    if (!spec || !w || !h) return null
    const r = spec.rect
    return { left: (r.x / w) * 100, top: (r.y / h) * 100, width: (r.w / w) * 100, height: (r.h / h) * 100 }
  }

  const ov = createMemo(() => over(active() ?? null))

  const displaySize = () => {
    const w = bw()
    const h = bh()
    if (!w || !h) return { width: 600, height: 400 }
    const shellW = cont?.clientWidth || 600
    const availH = Math.min(380, window.innerHeight * 0.5)
    const scale = Math.min(1, shellW / w, availH / h)
    return { width: Math.round(w * scale), height: Math.round(h * scale) }
  }

  const addCrop = () => {
    const w = bw()
    const h = bh()
    if (!dimsOk()) return
    const rect = { x: w * 0.05, y: h * 0.05, w: w * 0.9, h: h * 0.9 }
    const spec: CropSpec = {
      id: randomId(),
      ratioMode: 'free',
      presetId: null,
      customW: null,
      customH: null,
      sizeId: 'original',
      rect,
      ...remapToFrame(rect, w, h),
    }
    setCrops((prev) => [...prev, spec])
    setActiveId(spec.id)
  }

  const removeCrop = (id: string) => {
    setCrops((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) return prev
      if (activeId() === id) setActiveId(next[next.length - 1].id)
      return next
    })
  }

  const updateDrag = (e: PointerEvent) => {
    const el = shell
    const a = active()
    if (!el || !a || !drag) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const scaleX = bw() / rect.width
    const scaleY = bh() / rect.height
    if (drag.type === 'focus') {
      const px = clamp(((e.clientX - rect.left) * scaleX - a.rect.x) / a.rect.w * 100, 0, 100)
      const py = clamp(((e.clientY - rect.top) * scaleY - a.rect.y) / a.rect.h * 100, 0, 100)
      setActiveSpec({ focusX: px, focusY: py })
      return
    }
    const dx = (e.clientX - drag.startX) * scaleX
    const dy = (e.clientY - drag.startY) * scaleY
    if (drag.type === 'move') {
      patchRect({ x: drag.rect.x + dx, y: drag.rect.y + dy })
      return
    }
    const ratio = a.ratioMode === 'free' ? null : ratioOf(a)
    if (ratio === null) {
      patchRect({ w: drag.rect.w + dx, h: drag.rect.h + dy })
    } else {
      const minScale = Math.max(8 / drag.rect.w, 8 / drag.rect.h)
      const maxScale = Math.min(bw() / drag.rect.w, bh() / drag.rect.h)
      const wanted = Math.max((drag.rect.w + dx) / drag.rect.w, (drag.rect.h + dy) / drag.rect.h)
      const scale = Math.min(Math.max(wanted, minScale), maxScale)
      patchRect({ w: drag.rect.w * scale, h: drag.rect.h * scale })
    }
  }

  const apply = async () => {
    const b = bitmap()
    if (!b || crops().length === 0) {
      setError('Could not read the image — no crop applied.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const results: CropResult[] = []
      for (const spec of crops()) {
        const o = outDims(spec)
        if (!o) continue
        const canvas = document.createElement('canvas')
        canvas.width = o.w
        canvas.height = o.h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(b, spec.rect.x, spec.rect.y, spec.rect.w, spec.rect.h, 0, 0, o.w, o.h)
        const mime =
          props.file.type === 'image/png'
            ? 'image/png'
            : props.file.type === 'image/webp'
              ? 'image/webp'
              : 'image/jpeg'
        const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92))
        if (!out) throw new Error('Encoding failed')
        const dot = props.file.name.lastIndexOf('.')
        const base = dot > 0 ? props.file.name.slice(0, dot) : props.file.name
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
        const file = new File([out], `${base}.${ext}`, { type: out.type })
        results.push({
          file,
          width: o.w,
          height: o.h,
          label: `${ratioLabel(spec)} · ${o.w}×${o.h}`,
          srcX: spec.rect.x,
          srcY: spec.rect.y,
          srcW: spec.rect.w,
          srcH: spec.rect.h,
          focusX: clamp(Math.round(spec.focusX * 10) / 10, 0, 100),
          focusY: clamp(Math.round(spec.focusY * 10) / 10, 0, 100),
        })
      }
      props.onApply(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resize failed')
      setBusy(false)
    }
  }

  return (
    <div {...stylex.props(styles.overlay)} onClick={() => !busy() && props.onClose()}>
      <div {...stylex.props(styles.card)} onClick={(e) => e.stopPropagation()}>
        <div {...stylex.props(styles.header)}>
          <div>
            <h2 {...stylex.props(s.heading)}>Resize & crop</h2>
            <p {...stylex.props(s.subheading)}>
              Build one or more crops — each variant becomes its own asset with its own focus point. Drag to move, drag the corner to resize, drag the marker to set focus.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            disabled={busy()}
            onClick={props.onClose}
            {...stylex.props(s.btnIcon)}
          >
            <XIcon size={15} />
          </button>
        </div>

        <Show
          when={!loadError()}
          fallback={<p {...stylex.props(styles.error)}>Could not read this image for cropping.</p>}
        >
          <div ref={cont} {...stylex.props(styles.stage)}>
            <Show when={dimsOk()} fallback={<p {...stylex.props(s.muted)}>Reading image…</p>}>
              <div
                ref={shell}
                {...stylex.props(styles.previewShell)}
                style={{
                  width: `${displaySize().width}px`,
                  height: `${displaySize().height}px`,
                }}
                onPointerDown={(e) => {
                  const a = active()
                  if (!a || (e.target as Element).closest('[data-resize-handle], [data-focus-marker]')) return
                  e.preventDefault()
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  drag = { type: 'move', startX: e.clientX, startY: e.clientY, rect: { ...a.rect } }
                }}
                onPointerMove={(e) => {
                  if (drag) updateDrag(e)
                }}
                onPointerUp={() => (drag = null)}
                onPointerCancel={() => (drag = null)}
              >
                <img src={props.url} alt="" {...stylex.props(styles.previewImg)} />
                <Show when={ov()}>
                  <div
                    {...stylex.props(styles.cropBox)}
                    style={{
                      left: `${ov()!.left}%`,
                      top: `${ov()!.top}%`,
                      width: `${ov()!.width}%`,
                      height: `${ov()!.height}%`,
                    }}
                  >
                    <span {...stylex.props(styles.thirdsH)} style={{ top: '33.333%' }} />
                    <span {...stylex.props(styles.thirdsH)} style={{ top: '66.666%' }} />
                    <span {...stylex.props(styles.thirdsV)} style={{ left: '33.333%' }} />
                    <span {...stylex.props(styles.thirdsV)} style={{ left: '66.666%' }} />
                    <div
                      data-focus-marker
                      {...stylex.props(styles.focusMarker)}
                      style={{
                        left: `${active()?.focusX}%`,
                        top: `${active()?.focusY}%`,
                      }}
                      onPointerDown={(e) => {
                        const a = active()
                        if (!a) return
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.setPointerCapture?.(e.pointerId)
                        drag = { type: 'focus', startX: e.clientX, startY: e.clientY, rect: { ...a.rect } }
                      }}
                    >
                      <span {...stylex.props(styles.markerH)} />
                      <span {...stylex.props(styles.markerV)} />
                      <span {...stylex.props(styles.markerRing)} />
                    </div>
                    <div
                      data-resize-handle
                      {...stylex.props(styles.handle)}
                      onPointerDown={(e) => {
                        const a = active()
                        if (!a) return
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.setPointerCapture?.(e.pointerId)
                        drag = { type: 'resize', startX: e.clientX, startY: e.clientY, rect: { ...a.rect } }
                      }}
                    />
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          <Show when={dimsOk()}>
            <div {...stylex.props(styles.row)}>
              <span {...stylex.props(styles.rowLabel)}>Crop variants</span>
              <div {...stylex.props(styles.cropsRow)}>
                <For each={crops()}>
                  {(c) => (
                    <span
                      {...stylex.props(styles.cropChip, c.id === activeId() && styles.chipActive)}
                      onClick={() => setActiveId(c.id)}
                    >
                      {ratioLabel(c)}
                      <Show when={crops().length > 1}>
                        <button
                          type="button"
                          aria-label="Remove crop"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeCrop(c.id)
                          }}
                          {...stylex.props(styles.chipRemove)}
                        >
                          <XIcon size={10} />
                        </button>
                      </Show>
                    </span>
                  )}
                </For>
                <button type="button" onClick={addCrop} {...stylex.props(styles.cropChip)}>
                  <PlusIcon size={13} />
                  Add variant
                </button>
              </div>
            </div>

            <div {...stylex.props(styles.row)}>
              <span {...stylex.props(styles.rowLabel)}>Aspect ratio</span>
              <div {...stylex.props(styles.segWrap)}>
                <button
                  type="button"
                  onClick={() => setRatio('free')}
                  {...stylex.props(styles.chip, active()?.ratioMode === 'free' && styles.chipActive)}
                >
                  Free
                </button>
                <Show when={active()?.ratioMode !== 'free' && active()?.ratioMode === 'preset'}>
                  <span {...stylex.props(styles.ratioSep)}>|</span>
                </Show>
                <For each={RATIOS}>
                  {(r) => (
                    <button
                      type="button"
                      onClick={() => setRatio('preset', r.id, null, null)}
                      {...stylex.props(
                        styles.chip,
                        active()?.ratioMode === 'preset' && active()?.presetId === r.id && styles.chipActive,
                      )}
                    >
                      {r.label}
                    </button>
                  )}
                </For>
                <button
                  type="button"
                  onClick={() => setRatio('custom', null, 16, 10)}
                  {...stylex.props(styles.chip, active()?.ratioMode === 'custom' && styles.chipActive)}
                >
                  Custom…
                </button>
              </div>
              <Show when={active()?.ratioMode === 'custom'}>
                <div {...stylex.props(styles.customInputs)}>
                  <input
                    type="number"
                    min={1}
                    value={active()?.customW ?? ''}
                    onInput={(e) => setActiveSpec({ customW: parseInt(e.currentTarget.value, 10) || null })}
                    placeholder="16"
                    {...stylex.props(styles.customNum)}
                  />
                  <span {...stylex.props(styles.ratioSep)}>:</span>
                  <input
                    type="number"
                    min={1}
                    value={active()?.customH ?? ''}
                    onInput={(e) => setActiveSpec({ customH: parseInt(e.currentTarget.value, 10) || null })}
                    placeholder="10"
                    {...stylex.props(styles.customNum)}
                  />
                  <Show when={active()?.customW && active()?.customH}>
                    <button
                      type="button"
                      onClick={() => setRatio('custom', null, active()?.customW, active()?.customH)}
                      {...stylex.props(s.btn, s.btnGhost)}
                    >
                      Apply ratio
                    </button>
                  </Show>
                </div>
              </Show>
            </div>

            <div {...stylex.props(styles.row)}>
              <span {...stylex.props(styles.rowLabel)}>Output size (max edge, px)</span>
              <div {...stylex.props(styles.chips)}>
                <For each={SIZES}>
                  {(z) => (
                    <button
                      type="button"
                      onClick={() => setActiveSpec({ sizeId: z.id })}
                      {...stylex.props(styles.chip, active()?.sizeId === z.id && styles.chipActive)}
                    >
                      {z.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div {...stylex.props(styles.metaRow)}>
              <span>In: {Math.round(bw())} × {Math.round(bh())}</span>
              <span>·</span>
              <span>
                Variants:{' '}
                <span {...stylex.props(styles.kbd)}>
                  {crops()
                    .map((c) => outDims(c) ? `${outDims(c)!.w}×${outDims(c)!.h}` : '—')
                    .join(' · ')}
                </span>
              </span>
              <span>·</span>
              <span>
                Focus:{' '}
                <span {...stylex.props(styles.kbd)}>
                  {active() ? `${Math.round(active()!.focusX)}%, ${Math.round(active()!.focusY)}%` : '—'}
                </span>
                <span {...stylex.props(styles.rowLabel)}> (drag the marker)</span>
              </span>
            </div>
          </Show>
        </Show>

        <Show when={error()}>
          <p {...stylex.props(styles.error)}>{error()}</p>
        </Show>

        <div {...stylex.props(styles.footer)}>
          <button type="button" onClick={props.onClose} disabled={busy()} {...stylex.props(s.btnGhost)}>
            Cancel
          </button>
          <button type="button" onClick={apply} disabled={busy() || !dimsOk() || crops().length === 0} {...stylex.props(s.btn)}>
            {busy() ? 'Applying…' : `Apply ${crops().length} ${crops().length === 1 ? 'crop' : 'crops'}`}
          </button>
        </div>
      </div>
    </div>
  )
}