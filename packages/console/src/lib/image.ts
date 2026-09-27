/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 *
 * Client-side image processing helpers used by the upload + media flows.
 * Both return WebP files (requirement: images are stored as WebP) — the
 * thumbnail is a small downscaled WebP used for lazy loading.
 */

export interface ProcessedImage {
  /** The WebP file to store as the main asset. */
  file: File
  width: number
  height: number
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** Convert any browser-supported image File into a WebP File (same pixels). */
export async function toWebp(file: File, name?: string): Promise<ProcessedImage> {
  const bmp = await createImageBitmap(file)
  try {
    const width = bmp.width
    const height = bmp.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(bmp, 0, 0)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92))
    if (!out) throw new Error('WebP encoding failed')
    const base = stripExt(name ?? file.name)
    return {
      file: new File([out], `${base}.webp`, { type: 'image/webp' }),
      width,
      height,
    }
  } finally {
    bmp.close()
  }
}

/** Generate a small WebP thumbnail (max edge ~320px) for lazy loading. */
export async function makeThumb(file: File, name?: string): Promise<File> {
  const bmp = await createImageBitmap(file)
  try {
    const max = 320
    const width = bmp.width
    const height = bmp.height
    const scale = Math.min(1, max / Math.max(width, height))
    const tw = Math.max(1, Math.round(width * scale))
    const th = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, tw, th)
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
    if (!out) throw new Error('Thumbnail encoding failed')
    const base = stripExt(name ?? file.name)
    return new File([out], `${base}.thumb.webp`, { type: 'image/webp' })
  } finally {
    bmp.close()
  }
}