/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { useQueryClient } from '@tanstack/solid-query'
import { s, tokens } from '../theme.stylex'
import { api, type SeedApplySummary, type SeedSnapshot } from '../lib/api'
import { useCollections } from '../hooks/collections'
import { hasPermission } from '../lib/session'
import { logActivity } from '../lib/activity'
import { DownloadIcon, UploadIcon } from '../components/Icons'

const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: tokens.text,
    marginBottom: 2,
  },
  subheading: {
    fontSize: 13,
    color: tokens.textDim,
    maxWidth: 560,
    lineHeight: 1.5,
  },
  panel: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    padding: 20,
    maxWidth: 720,
  },
  section: {
    marginTop: 26,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 700,
    color: tokens.text,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: tokens.textDim,
    marginBottom: 14,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 460,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  warn: {
    fontSize: 13,
    color: tokens.danger,
    lineHeight: 1.5,
  },
  status: {
    fontSize: 13,
    color: tokens.ok,
    lineHeight: 1.5,
  },
  meta: {
    marginTop: 12,
    paddingTop: 12,
    boxShadow: `inset 0 1px 0 0 ${tokens.border}`,
    fontSize: 12,
    color: tokens.textDim,
    lineHeight: 1.6,
    fontFamily: tokens.fontMono,
    overflowWrap: 'anywhere',
  },
  error: {
    fontSize: 13,
    color: tokens.danger,
    lineHeight: 1.5,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
})

export function SeedPage() {
  const queryClient = useQueryClient()
  const collections = useCollections()

  const [scope, setScope] = createSignal('all')
  const [mediaBytes, setMediaBytes] = createSignal(false)
  const [exporting, setExporting] = createSignal(false)
  const [exportError, setExportError] = createSignal('')
  const [exportMeta, setExportMeta] = createSignal('')

  const [file, setFile] = createSignal<File | null>(null)
  const [wipe, setWipe] = createSignal(true)
  const [applying, setApplying] = createSignal(false)
  const [applyError, setApplyError] = createSignal('')
  const [applyMeta, setApplyMeta] = createSignal('')

  const names = () =>
    (collections.data ?? [])
      .map((c) => c.name)
      .sort()

  async function onExport() {
    setExporting(true)
    setExportError('')
    setExportMeta('')
    try {
      const snap = await api.exportSeed(scope(), mediaBytes())
      const records = Object.values(snap.records ?? {}).reduce((n, rows) => n + (rows?.length ?? 0), 0)
      const bytes = new Blob([JSON.stringify(snap, null, 2)]).size
      const date = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `seed-${snap.land || 'default'}-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
      logActivity('seed.export', 'Exported seed snapshot', `${snap.collections.length} collections · ${records} records`)
      setExportMeta(
        `Exported ${snap.collections.length} collection(s), ${records} record(s), ${(snap.media ?? []).length} media asset(s) — ${formatBytes(bytes)}.`,
      )
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function onApply() {
    const f = file()
    if (!f) {
      setApplyError('Choose a snapshot (.json) file first.')
      return
    }
    if (!window.confirm(wipe() ? 'Wipe existing collections, media and records, then apply this snapshot?' : 'Apply this snapshot on top of the current data?')) {
      return
    }
    setApplyError('')
    setApplyMeta('')
    setApplying(true)
    try {
      const text = await f.text()
      const snap = JSON.parse(text) as SeedSnapshot
      const { data } = await api.applySeed(snap, wipe())
      logActivity('seed.apply', 'Applied seed snapshot', `${data.collections.length} collections · ${data.records} records`)
      queryClient.clear()
      setApplyMeta(summaryText(data))
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setApplying(false)
    }
  }

  return (
    <section>
      <header {...stylex.props(styles.header)}>
        <div>
          <h2 {...stylex.props(styles.heading)}>Seed</h2>
          <p {...stylex.props(styles.subheading)}>
            Export the current state (collection definitions, records, groups, settings and media) into a
            reproducible JSON snapshot, or restore a snapshot by wiping and re-applying it.
          </p>
        </div>
      </header>

      <Show
        when={hasPermission('settings.write')}
        fallback={
          <div {...stylex.props(styles.panel, styles.section)}>
            <p {...stylex.props(styles.error)}>You need the “settings.write” permission to export or apply seeds.</p>
          </div>
        }
      >
        <div {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.panel)}>
            <h3 {...stylex.props(styles.sectionHeading)}>Export snapshot</h3>
            <p {...stylex.props(styles.sectionHint)}>
              Downloads a <span {...stylex.props(s.badge)}>seed-*.json</span> file that can be re-applied here or via the CLI.
            </p>
            <div {...stylex.props(styles.form)}>
              <div {...stylex.props(styles.row)}>
                <span {...stylex.props(styles.label)}>Scope</span>
                <select {...stylex.props(s.select)} value={scope()} onChange={(e) => setScope(e.currentTarget.value)}>
                  <option value="all">All collections</option>
                  <For each={names()}>
                    {(name) => <option value={name}>{name}</option>}
                  </For>
                </select>
              </div>
              <div {...stylex.props(styles.row)}>
                <span {...stylex.props(styles.label)}>Media</span>
                <select
                  {...stylex.props(s.select)}
                  value={mediaBytes() ? 'bytes' : 'none'}
                  onChange={(e) => setMediaBytes(e.currentTarget.value === 'bytes')}
                >
                  <option value="bytes">Include media bytes (base64)</option>
                  <option value="none">References only</option>
                </select>
              </div>
              <div {...stylex.props(styles.footer)}>
                <button
                  type="button"
                  {...stylex.props(s.btn)}
                  onClick={onExport}
                  disabled={exporting()}
                >
                  <DownloadIcon size={14} />
                  {exporting() ? 'Exporting…' : 'Download snapshot'}
                </button>
              </div>
            </div>
            <Show when={exportMeta()}>
              <p {...stylex.props(styles.meta)}>{exportMeta()}</p>
            </Show>
            <Show when={exportError()}>
              <p {...stylex.props(styles.error)}>{exportError()}</p>
            </Show>
          </div>
        </div>

        <div {...stylex.props(styles.section)}>
          <div {...stylex.props(styles.panel)}>
            <h3 {...stylex.props(styles.sectionHeading)}>Apply snapshot</h3>
            <p {...stylex.props(styles.sectionHint)}>
              Restores groups, collections, records, settings and media from a <span {...stylex.props(s.badge)}>seed-*.json</span> file.
            </p>
            <div {...stylex.props(styles.form)}>
              <div {...stylex.props(styles.row)}>
                <span {...stylex.props(styles.label)}>Snapshot file</span>
                <div {...stylex.props(styles.fileRow)}>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  />
                  <Show when={file()}>
                    <span {...stylex.props(s.badge)}>{file()!.name}</span>
                  </Show>
                </div>
              </div>
              <div {...stylex.props(styles.row)}>
                <label>
                  <input
                    type="checkbox"
                    checked={wipe()}
                    onChange={(e) => setWipe(e.currentTarget.checked)}
                  />
                  <span {...stylex.props(styles.label)}>Wipe existing collection / media / record data first</span>
                </label>
              </div>
              <Show when={!wipe()}>
                <p {...stylex.props(styles.warn)}>
                  Wipe is off — groups/collections will be upserted and records/media applied with INSERT OR REPLACE on top of existing data.
                </p>
              </Show>
              <div {...stylex.props(styles.footer)}>
                <button
                  type="button"
                  {...stylex.props(s.btn)}
                  onClick={onApply}
                  disabled={applying()}
                >
                  <UploadIcon size={14} />
                  {applying() ? 'Applying…' : 'Apply snapshot'}
                </button>
              </div>
            </div>
            <Show when={applyMeta()}>
              <div {...stylex.props(styles.meta)}>{applyMeta()}</div>
            </Show>
            <Show when={applyError()}>
              <p {...stylex.props(styles.error)}>{applyError()}</p>
            </Show>
          </div>
        </div>
      </Show>
    </section>
  )
}

function summaryText(data: SeedApplySummary): string {
  return (
    `Applied snapshot from ${data.sourceLand || 'default'} (${data.sourceOrigin || 'unknown origin'}): ` +
    `${data.collections.length} collection(s), ${data.records} record(s), ` +
    `${data.groups} group(s), ${data.media} media asset(s) with ${data.mediaObjects} R2 object(s) restored.`
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}