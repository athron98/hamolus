/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

/**
 * The Configuration screen — the one place that edits environment-level state.
 *
 * It holds **two unrelated stores**, and saying so is most of the work: a user who cannot
 * tell them apart cannot tell which one a site reads, so each section names its own
 * storage and its own permissions.
 *
 * 1. **Key/value entries** — rows in the core's internal `_configs` D1 table, one per
 *    `(colony, key)`. There is no classification column: the colony a row lives in *is*
 *    its scope. CRUD over `GET /api/_config`, `PUT /api/_config/{key}`,
 *    `DELETE /api/_config/{key}`; needs `config.read` to see and `config.write` to
 *    change. `PUT` is an **upsert** and the key is matched case-insensitively
 *    (`COLLATE NOCASE`). A `?land=` / `?colony=` query narrows a read, and the core
 *    checks it against the session: a land admin reaches every colony of its own land, a
 *    colony admin only its own. Nothing in the core interprets these rows — no endpoint
 *    turns a key into a page. They are a typed key/value store for your own app, agent or
 *    MCP server to read over the API.
 * 2. **The settings blob** — one free-form JSON object in KV under
 *    `settings:{land}:{colony}:v1` (the root scope keeps the legacy `settings:v1` key),
 *    edited as a whole over `GET`/`PUT /api/_meta/settings`; needs `settings.read` and
 *    `settings.write`. `PUT` is a **shallow top-level merge**: a key deleted in the editor
 *    comes back on the next read, because the core only ever adds and overwrites. This is
 *    the store `site.*` conventionally lives in — the generated site templates do not
 *    fetch it for you, so a front end has to ask for it.
 *
 * What it refuses: the screen needs `config.read` (a direct visit to `/config` without it
 * explains the refusal instead of hanging on "Loading"), each editor degrades to
 * read-only without its write permission, a config key is validated against the core's own
 * pattern before the request is sent, and Delete goes through a confirmation dialog rather
 * than a second click.
 */

import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { ConfigEntry, ConfigEntryInput } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { api } from '../lib/api'
import type { ConfigTarget } from '../lib/api'
import { hasPermission, hydrated, user } from '../lib/session'
import { logActivity } from '../lib/activity'
import { Sheet } from '../components/Sheet'
import { JsonEditor } from '../components/JsonEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'

/**
 * The suffixes the core uses to tell the two kinds of node apart, checked locally for
 * the same reason `KEY_PATTERN` is (see below): `isLandId`/`isColonyId` are runtime
 * values, and importing them would pull zod into the console bundle for two `endsWith`
 * calls. Ids arriving from the API are already normalized, so the suffix is enough.
 */
const COLONY_SUFFIX = '_cny'

/** A land or colony id from the registry; `''` is the client-side word for "no target". */
type NodeId = string

const isColonyNode = (id: NodeId): boolean => id.endsWith(COLONY_SUFFIX)

/** The `<select>` value to a request target: one colony, one land, or nothing at all. */
function targetOf(selected: NodeId): ConfigTarget | undefined {
  if (!selected) return undefined
  return isColonyNode(selected) ? { colony: selected } : { land: selected }
}

/**
 * The key pattern from `configEntrySchema` in `@hamolus/types` and `KEY_PATTERN` in
 * `@hamolus/core`'s `auth/config.ts`. It is repeated here rather than imported because the
 * schema is a runtime value and importing it would pull zod into the console bundle for one
 * regex — the console imports that package for its types only, which erase at compile time.
 * If the server-side pattern changes, change it here too.
 */
const KEY_PATTERN = /^[a-z][a-z0-9._-]*$/
const KEY_MAX = 100

/**
 * Shown only when the blob is still empty, and only as a button — never as the editor's
 * initial value. Prefilling the editor with an example is how an unrelated `PUT` ends up
 * writing the example over a real project.
 */
const EXAMPLE_BLOB = JSON.stringify(
  {
    site: {
      name: 'Hamolus',
      tagline: 'A Cloudflare Workers monorepo: core API, admin console, public site',
      navigation: [
        { label: 'Home', href: '/' },
        { label: 'Posts', href: '/posts' },
      ],
    },
  },
  null,
  2,
)

const styles = stylex.create({
  page: {
    padding: 28,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    color: tokens.text,
    margin: 0,
  },
  subheading: {
    fontSize: 13,
    color: tokens.textDim,
    maxWidth: 620,
    lineHeight: 1.5,
    margin: '4px 0 0',
  },
  section: {
    marginTop: 26,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 700,
    color: tokens.text,
    margin: '0 0 4px',
  },
  sectionHint: {
    fontSize: 13,
    color: tokens.textDim,
    margin: '0 0 14px',
    lineHeight: 1.5,
    maxWidth: 620,
  },
  tableWrap: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 720,
  },
  th: {
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    backgroundColor: tokens.surface,
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '9px 12px',
    fontSize: 13,
    color: tokens.text,
    boxShadow: `inset 0 -1px 0 0 ${tokens.border}`,
    verticalAlign: 'middle',
  },
  keyCell: {
    fontFamily: tokens.fontMono,
    fontWeight: 600,
    color: tokens.accent,
    whiteSpace: 'nowrap',
  },
  valueCell: {
    fontFamily: tokens.fontMono,
    fontSize: 12,
    color: tokens.textDim,
    maxWidth: 320,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  descCell: {
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.textDim,
  },
  stampCell: {
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
    whiteSpace: 'nowrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: tokens.radiusSm,
    fontFamily: tokens.fontMono,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  scopeColony: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  scopeLand: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  empty: {
    padding: 24,
    color: tokens.textDim,
    fontSize: 13,
    margin: 0,
  },
  panel: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    padding: 20,
    maxWidth: 720,
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    marginBottom: 12,
    fontSize: 13,
    color: tokens.danger,
    backgroundColor: tokens.dangerSoft,
    borderRadius: tokens.radiusSm,
    lineHeight: 1.5,
  },
  warn: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    marginBottom: 12,
    fontSize: 13,
    color: tokens.text,
    backgroundColor: tokens.accentSoft,
    borderRadius: tokens.radiusSm,
    lineHeight: 1.5,
  },
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterCount: {
    fontSize: 12,
    color: tokens.textDim,
    marginLeft: 'auto',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxWidth: 460,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    fontSize: 13,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: tokens.textDim,
  },
  input: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
    padding: '9px 10px',
    fontSize: 13,
    color: tokens.text,
    borderStyle: 'none',
    fontFamily: tokens.fontMono,
    boxShadow: `inset 0 0 0 1px ${tokens.border}`,
  },
  inputInvalid: {
    boxShadow: `inset 0 0 0 1px ${tokens.danger}`,
  },
  textarea: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
    padding: '10px',
    fontSize: 13,
    color: tokens.text,
    borderStyle: 'none',
    fontFamily: tokens.fontMono,
    resize: 'vertical',
    minHeight: 120,
    boxShadow: `inset 0 0 0 1px ${tokens.border}`,
  },
  select: {
    backgroundColor: tokens.surfaceRaised,
    borderRadius: tokens.radiusSm,
    padding: '9px 10px',
    fontSize: 13,
    color: tokens.text,
    borderStyle: 'none',
    fontFamily: tokens.fontMono,
    boxShadow: `inset 0 0 0 1px ${tokens.border}`,
  },
  error: {
    fontSize: 13,
    color: tokens.danger,
    margin: 0,
  },
  hint: {
    fontSize: 12,
    color: tokens.textDim,
    margin: 0,
  },
  status: {
    fontSize: 13,
    color: tokens.ok,
  },
})

/** A colony is the row's own scope; a land is the tree it sits in. */
function nodePill(id: NodeId) {
  return isColonyNode(id) ? styles.scopeColony : styles.scopeLand
}

/**
 * `land: / colony:` for a table cell, labelled from the registry when this session is
 * allowed to read it and falling back to the raw ids when it is not. The ids are always
 * in the `title`, because a label that cannot be seen is worse than no label.
 */
function nodeLabel(
  landId: string,
  colonyId: string,
  labels: Map<string, string>,
  withLand: boolean,
): string {
  const colony = labels.get(colonyId) ?? colonyId
  if (!withLand) return colony
  const land = labels.get(landId) ?? landId
  return `${land} / ${colony}`
}

/**
 * Two renderings of one value: the single line that fits a table cell, and the whole thing
 * for the cell's `title`. Truncating without a way to see the rest made a long navigation
 * array indistinguishable from a bug.
 */
function previewValue(v: unknown): { short: string; full: string } {
  if (v === undefined) return { short: '—', full: '' }
  let full: string
  if (typeof v === 'string') {
    full = v
  } else {
    try {
      full = JSON.stringify(v, null, 2) ?? String(v)
    } catch {
      full = String(v)
    }
  }
  const oneLine = typeof v === 'string' ? v : full.replace(/\s*\n\s*/g, ' ')
  return { short: oneLine.length > 90 ? `${oneLine.slice(0, 90)}…` : oneLine, full }
}

/** The core stores a UTC ISO stamp; trimming it keeps the column narrow and unambiguous. */
function formatStamp(iso: string | undefined): string {
  if (!iso) return '—'
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function ConfigPage() {
  const queryClient = useQueryClient()

  // A localStorage snapshot is not a confirmed session — see `hydrated` in lib/session.
  // Permission-gated queries wait for it so a stale snapshot cannot authorise a request
  // the current token refuses.
  const sessionReady = () => hydrated()
  const canReadEntries = () => hasPermission('config.read')
  const canWriteEntries = () => hasPermission('config.write')
  const canReadBlob = () => hasPermission('settings.read')
  const canWriteBlob = () => hasPermission('settings.write')
  /**
   * The land/colony selector is built from the universe registry, and the core gates
   * those endpoints on `lands.read` / `colonies.read`. A session without them does not
   * get an empty dropdown it cannot use — it gets no selector, and the core falls back
   * to the scope its token already carries.
   */
  const canReadLands = () => hasPermission('lands.read')
  const canReadColonies = () => hasPermission('colonies.read')
  const canPickNode = () => canReadLands() || canReadColonies()

  // ---- Key/value entries (`_configs`) ----

  /** `''` = everything this session may see; otherwise a land or colony id. */
  const [selected, setSelected] = createSignal<NodeId>('')
  const target = createMemo<ConfigTarget | undefined>(() => targetOf(selected()))

  /**
   * Labels for the table, gathered from the same registry the selector uses. Kept as a
   * plain map rather than a lookup into the option list so a row whose land is not in
   * `lands` (a stale id, or a session that may read colonies but not lands) still reads.
   */
  const lands = createQuery(() => ({
    // Keyed by session: two tokens can be swapped in one browser (that is how land and
    // colony sessions get compared), and a shared `['config-lands']` entry would hand
    // the next session the previous one's registry — with `enabled` flipping a moment
    // later, it also fires one doomed request carrying the wrong token.
    queryKey: ['config-lands', user()?.id ?? 'anonymous'],
    queryFn: () => api.listLands().then((r) => r.data),
    enabled: sessionReady() && canReadLands(),
  }))
  const colonies = createQuery(() => ({
    queryKey: ['config-colonies', user()?.id ?? 'anonymous'],
    queryFn: () => api.listColonies().then((r) => r.data),
    enabled: sessionReady() && canReadColonies(),
  }))

  const nodeLabels = createMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const l of lands.data ?? []) map.set(l.id, l.label)
    for (const c of colonies.data ?? []) map.set(c.id, c.label)
    return map
  })

  /** Colonies of the selected land, for the "new entry" colony picker. */
  const selectableColonies = createMemo(() => {
    const sel = selected()
    const all = colonies.data ?? []
    if (sel && !isColonyNode(sel)) return all.filter((c) => c.landId === sel)
    return all
  })

  const configs = createQuery(() => ({
    // The target lives in the key so switching it is a different query, not a refetch of
    // the same one with a different answer — and so is the session, because the target
    // is relative: `''` means "what this token may see", which is not one fixed answer.
    queryKey: ['config', user()?.id ?? 'anonymous', target()?.land ?? '', target()?.colony ?? ''],
    queryFn: () => api.listConfigs(target()).then((r) => r.data),
    enabled: sessionReady() && canReadEntries(),
  }))

  const [editing, setEditing] = createSignal<ConfigEntry | 'new' | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const [key, setKey] = createSignal('')
  /** Which colony a new row is written into; `''` lets the core pick its own default. */
  const [formColony, setFormColony] = createSignal<NodeId>('')
  /**
   * Whether the new-entry form must name a colony. True only when a picker is actually on
   * screen: a session without `colonies.read` has no list to choose from, and the core
   * resolves its own colony. Treating "no picker" as "nothing chosen" would leave that
   * session with a form it can never submit.
   */
  const colonyMustBeChosen = () => editing() === 'new' && selectableColonies().length > 0
  const [description, setDescription] = createSignal('')
  const [jsonText, setJsonText] = createSignal('')
  const [jsonError, setJsonError] = createSignal<string | null>(null)

  const [pendingDelete, setPendingDelete] = createSignal<ConfigEntry | null>(null)
  const [deletingKey, setDeletingKey] = createSignal<string | null>(null)
  const [deleteError, setDeleteError] = createSignal<string | null>(null)

  /** Live check against the core's own key rules, so a rejection is not the first feedback. */
  const keyProblem = createMemo<string | null>(() => {
    const k = key().trim()
    if (!k) return 'Key is required'
    if (k.length > KEY_MAX) return `Key is at most ${KEY_MAX} characters`
    if (!KEY_PATTERN.test(k)) {
      return 'Start with a lowercase letter, then lowercase letters, digits, dots, dashes or underscores'
    }
    return null
  })

  /**
   * Where a save or a delete lands. An existing entry always writes back to its own
   * colony — the row is identified by `(land, colony, key)`, so there is no moving it;
   * a new one needs a colony, and the picker above is where that choice is made.
   */
  const writeTarget = createMemo<ConfigTarget | undefined>(() => {
    const entry = editing()
    if (entry && entry !== 'new') return { land: entry.land, colony: entry.colony }
    const colony = formColony()
    if (colony) return { colony }
    const sel = selected()
    if (sel && isColonyNode(sel)) return { colony: sel }
    if (sel) return { land: sel }
    return undefined
  })

  /**
   * `PUT` upserts on `(land, colony, key)` and that key is `COLLATE NOCASE`, so a "new"
   * entry whose key already exists *in the colony being written* quietly replaces the
   * stored value. A collision in a different colony is a different row and is not a
   * duplicate at all — which is why this only looks at the rows the form will overwrite.
   */
  const duplicate = createMemo<ConfigEntry | null>(() => {
    if (editing() !== 'new') return null
    const k = key().trim().toLowerCase()
    if (!k || keyProblem()) return null
    const to = writeTarget()
    return (
      (configs.data ?? []).find(
        (e) =>
          e.key.toLowerCase() === k &&
          (!to?.colony || e.colony === to.colony) &&
          (!to?.land || e.land === to.land),
      ) ?? null
    )
  })

  const openNew = () => {
    setError(null)
    setKey('')
    // Prefill the colony so Save is one click: the selection if it names a colony, the
    // first colony of the selected land, otherwise nothing and the core picks its own.
    const sel = selected()
    setFormColony(isColonyNode(sel) ? sel : (selectableColonies()[0]?.id ?? ''))
    setDescription('')
    setJsonText('null')
    setJsonError(null)
    setEditing('new')
  }

  const openEdit = (entry: ConfigEntry) => {
    setError(null)
    setKey(entry.key)
    setFormColony(entry.colony)
    setDescription(entry.description ?? '')
    setJsonText(JSON.stringify(entry.value, null, 2))
    setJsonError(null)
    setEditing(entry)
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy() || !editing()) return
    const problem = keyProblem()
    if (problem) {
      setError(problem)
      return
    }
    let value: unknown
    try {
      value = JSON.parse(jsonText())
    } catch (err) {
      setJsonError(errorMessage(err, 'Invalid JSON'))
      return
    }
    setBusy(true)
    setError(null)
    setJsonError(null)
    try {
      const input: ConfigEntryInput = {
        key: key().trim(),
        value,
        description: description().trim() || null,
      }
      const wasNew = editing() === 'new'
      const to = writeTarget()
      await api.putConfig(input.key, input, to)
      logActivity(
        wasNew ? 'config.create' : 'config.update',
        wasNew ? 'Created config' : 'Updated config',
        to?.colony ? `${input.key} (${to.colony})` : input.key,
      )
      await queryClient.invalidateQueries({ queryKey: ['config'] })
      setEditing(null)
    } catch (err) {
      setError(errorMessage(err, 'Failed to save config'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const entry = pendingDelete()
    if (!entry || deletingKey()) return
    setDeletingKey(entry.key)
    setDeleteError(null)
    try {
      // Addressed by the row's own colony, never by the current selection: the dialog
      // names one row, and the selection may have moved since it was opened.
      await api.deleteConfig(entry.key, { land: entry.land, colony: entry.colony })
      logActivity('config.delete', 'Deleted config', `${entry.key} (${entry.colony})`)
      await queryClient.invalidateQueries({ queryKey: ['config'] })
      if (editing() === entry) setEditing(null)
      setPendingDelete(null)
    } catch (err) {
      // Left open on purpose: the row is still there, so the dialog still describes the
      // state the user is in.
      setDeleteError(errorMessage(err, 'Failed to delete config'))
    } finally {
      setDeletingKey(null)
    }
  }

  // ---- Settings blob (KV) ----
  const settings = createQuery(() => ({
    queryKey: ['settings'],
    queryFn: () => api.getSettings().then((r) => r.data),
  }))

  const [json, setJson] = createSignal('')
  /** The last text known to be stored; `null` until the blob has been read at least once. */
  const [stored, setStored] = createSignal<string | null>(null)
  const [settingsError, setSettingsError] = createSignal<string | null>(null)
  const [settingsBusy, setSettingsBusy] = createSignal(false)
  const [saved, setSaved] = createSignal(false)

  /**
   * Seed the editor from the core, once per load. This is the difference between an editor
   * and a form that invents its own contents: before it, the field started on a hardcoded
   * example and `PUT`'d it over whatever was stored, because the real blob was never
   * fetched — `getSettings()` existed in the API client and had no caller.
   */
  createEffect(() => {
    const data = settings.data
    if (!data) return
    const text = JSON.stringify(data, null, 2)
    setJson(text)
    setStored(text)
  })

  const blobLoaded = () => stored() !== null
  /**
   * Emptiness is read from what the core returned, never from the editor's text: the editor
   * holds whatever has been typed, and parsing that to answer "is it empty" would throw on
   * the half-typed JSON this screen exists to accept.
   */
  const blobEmpty = createMemo(() => {
    const data = settings.data
    return data !== undefined && Object.keys(data).length === 0
  })
  const dirty = () => blobLoaded() && json() !== stored()

  const saveSettings = async (e: Event) => {
    e.preventDefault()
    if (settingsBusy() || !canWriteBlob()) return
    let parsed: unknown
    try {
      parsed = JSON.parse(json() || '{}')
    } catch (err) {
      setSettingsError(errorMessage(err, 'Settings must be valid JSON'))
      return
    }
    // The core merges shallowly over the current blob, so a non-object body would replace
    // nothing and store nothing useful. Say it here instead of watching it not happen.
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setSettingsError('Settings must be a JSON object — the core merges top-level keys only')
      return
    }
    setSettingsBusy(true)
    setSettingsError(null)
    try {
      const { data } = await api.putSettings(parsed as Record<string, unknown>)
      // The response is the *merged* result, so the editor adopts it: a key the user
      // deleted is back, and showing anything else would claim otherwise.
      const text = JSON.stringify(data, null, 2)
      setJson(text)
      setStored(text)
      logActivity('settings.update', 'Updated settings')
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSettingsError(errorMessage(err, 'Failed to save settings'))
    } finally {
      setSettingsBusy(false)
    }
  }

  // ---- Change password ----
  const isLegacyAdmin = () =>
    user() !== null && user()!.id === 'admin' && user()!.privilegeName === 'admin'

  const [currentPassword, setCurrentPassword] = createSignal('')
  const [newPassword, setNewPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [pwError, setPwError] = createSignal<string | null>(null)
  const [pwSaved, setPwSaved] = createSignal(false)
  const [pwBusy, setPwBusy] = createSignal(false)

  const savePassword = async (e: Event) => {
    e.preventDefault()
    if (pwBusy()) return
    const curr = currentPassword()
    const next = newPassword()
    const confirm = confirmPassword()
    if (!curr) {
      setPwError('Enter your current password')
      return
    }
    if (next.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (next !== confirm) {
      setPwError('New password and confirmation do not match')
      return
    }
    setPwBusy(true)
    setPwError(null)
    try {
      await api.changeMyPassword({ currentPassword: curr, newPassword: next })
      logActivity('user.update', 'Changed own password')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2500)
    } catch (err) {
      setPwError(errorMessage(err, 'Failed to change password'))
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <div>
          <h1 {...stylex.props(styles.heading)}>Configuration</h1>
          <p {...stylex.props(styles.subheading)}>
            Environment-level state for the active land and colony. Two separate stores live
            here: key/value entries in the core&apos;s D1 table, and one free-form settings blob
            in Cloudflare KV. Each section says which one it edits.
          </p>
        </div>
        <Show when={canWriteEntries()}>
          <button type="button" onClick={openNew} title="New config" {...stylex.props(s.btnIcon)}>
            <PlusIcon size={15} />
          </button>
        </Show>
      </div>

      <Show
        when={sessionReady()}
        fallback={<p {...stylex.props(styles.empty)}>Loading your session…</p>}
      >
        <Show
          when={canReadEntries()}
          fallback={
            <div {...stylex.props(styles.panel)}>
              <p {...stylex.props(styles.error)}>
                You need the “config.read” permission to see configuration.
              </p>
            </div>
          }
        >
          <h2 {...stylex.props(styles.sectionHeading)}>Key/value entries</h2>
          <p {...stylex.props(styles.sectionHint)}>
            Rows in the core&apos;s <span {...stylex.props(s.badge)}>_configs</span> table, one per
            colony and key — a typed key/value store for your own app, agent or MCP server to
            read over <span {...stylex.props(s.badge)}>GET /api/_config</span>. The colony a row
            lives in <em>is</em> its scope; the core does not interpret the key or the value, so
            a row is a convention rather than something a generated site will render.
          </p>

          <Show when={canPickNode()}>
            <div {...stylex.props(styles.filters)}>
              <select
                value={selected()}
                onChange={(e) => setSelected(e.currentTarget.value)}
                aria-label="Filter entries by land or colony"
                {...stylex.props(styles.select)}
              >
                <option value="">All I can access</option>
                <Show when={(lands.data ?? []).length > 0}>
                  <optgroup label="Lands">
                    <For each={lands.data ?? []}>
                      {(l) => (
                        <option value={l.id} selected={l.id === selected()}>
                          {l.label} ({l.id})
                        </option>
                      )}
                    </For>
                  </optgroup>
                </Show>
                <Show when={(colonies.data ?? []).length > 0}>
                  <optgroup label="Colonies">
                    <For each={colonies.data ?? []}>
                      {(c) => (
                        <option value={c.id} selected={c.id === selected()}>
                          {c.label} ({c.id})
                        </option>
                      )}
                    </For>
                  </optgroup>
                </Show>
              </select>
              <Show when={!configs.isPending && !configs.isError}>
                <span {...stylex.props(styles.filterCount)}>
                  {(configs.data ?? []).length}{' '}
                  {selected() ? (isColonyNode(selected()) ? 'in this colony' : 'in this land') : 'entries'}
                </span>
              </Show>
            </div>
          </Show>
          <Show when={!canPickNode()}>
            <p {...stylex.props(styles.hint)}>
              Showing the entries your session can reach. Pick a land or colony from{' '}
              <span {...stylex.props(s.badge)}>Universe</span> to narrow it — that needs the{' '}
              <span {...stylex.props(s.badge)}>lands.read</span> or{' '}
              <span {...stylex.props(s.badge)}>colonies.read</span> permission.
            </p>
          </Show>

          <Show
            when={!configs.isError}
            fallback={
              <div {...stylex.props(styles.notice)}>
                <span>
                  Could not load entries: {errorMessage(configs.error, 'the core refused the request')}
                </span>
                <button type="button" onClick={() => void configs.refetch()} {...stylex.props(s.btn, s.btnGhost)}>
                  Retry
                </button>
              </div>
            }
          >
            <Show
              when={!configs.isPending}
              fallback={<p {...stylex.props(styles.empty)}>Loading entries…</p>}
            >
              <Show
                when={(configs.data ?? []).length > 0}
                fallback={
                  <p {...stylex.props(styles.empty)}>
                    {!selected()
                      ? 'No config entries yet. Use the + button to add one.'
                      : `No entries in ${nodeLabels().get(selected()) ?? selected()}.`}
                  </p>
                }
              >
                <div {...stylex.props(styles.tableWrap)}>
                  <table {...stylex.props(styles.table)}>
                    <thead>
                      <tr>
                        <th {...stylex.props(styles.th)}>Key</th>
                        <th {...stylex.props(styles.th)}>Colony</th>
                        <th {...stylex.props(styles.th)}>Value</th>
                        <th {...stylex.props(styles.th)}>Description</th>
                        <th {...stylex.props(styles.th)}>Updated</th>
                        <th {...stylex.props(styles.th)} />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={configs.data ?? []}>
                        {(entry) => {
                          const preview = () => previewValue(entry.value)
                          // The land is only worth a column of its own when the list
                          // spans several of them; otherwise the colony name says it.
                          const withLand = !selected() || !isColonyNode(selected())
                          return (
                            <tr>
                              <td {...stylex.props(styles.td, styles.keyCell)}>{entry.key}</td>
                              <td
                                {...stylex.props(styles.td)}
                                title={`${entry.land} / ${entry.colony}`}
                              >
                                <span {...stylex.props(styles.pill, nodePill(entry.colony))}>
                                  {nodeLabel(entry.land, entry.colony, nodeLabels(), withLand)}
                                </span>
                              </td>
                              <td
                                {...stylex.props(styles.td, styles.valueCell)}
                                title={preview().full}
                              >
                                {preview().short}
                              </td>
                              <td
                                {...stylex.props(styles.td, styles.descCell)}
                                title={entry.description ?? ''}
                              >
                                {entry.description ?? '—'}
                              </td>
                              <td
                                {...stylex.props(styles.td, styles.stampCell)}
                                title={entry.updatedAt ?? ''}
                              >
                                {formatStamp(entry.updatedAt)}
                              </td>
                              <td {...stylex.props(styles.td)}>
                                <Show when={canWriteEntries()}>
                                  <div {...stylex.props(styles.actions)}>
                                    <button
                                      type="button"
                                      onClick={() => openEdit(entry)}
                                      title={`Edit ${entry.key}`}
                                      {...stylex.props(s.btnIcon, s.btnIconSm)}
                                    >
                                      <PencilIcon size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteError(null)
                                        setPendingDelete(entry)
                                      }}
                                      disabled={deletingKey() === entry.key}
                                      title={`Delete ${entry.key}`}
                                      {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
                                    >
                                      <TrashIcon size={13} />
                                    </button>
                                  </div>
                                </Show>
                              </td>
                            </tr>
                          )
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Show>
          </Show>

          <Show when={pendingDelete()}>
            <ConfirmDialog
              title={`Delete “${pendingDelete()!.key}”?`}
              message={`This removes the entry from _configs in colony ${nodeLabel(
                pendingDelete()!.land,
                pendingDelete()!.colony,
                nodeLabels(),
                false,
              )}. Anything reading it over the API stops finding it. A key in another colony is a different row and is not touched.`}
              confirmLabel={deletingKey() ? 'Deleting…' : 'Delete'}
              cancelLabel="Keep entry"
              danger
              onConfirm={() => void confirmDelete()}
              onCancel={() => {
                if (!deletingKey()) {
                  setPendingDelete(null)
                  setDeleteError(null)
                }
              }}
            />
            <Show when={deleteError()}>
              <p {...stylex.props(styles.error)}>{deleteError()}</p>
            </Show>
          </Show>

          <Show when={editing()}>
            <Sheet
              title={
                editing() === 'new' ? 'New config' : `Edit ${(editing() as ConfigEntry).key}`
              }
              // A save in flight owns the sheet: closing it would leave the row list
              // refetching into a form nobody is watching.
              onCloseRequest={async () => !busy()}
              onExited={() => setEditing(null)}
            >
              <form onSubmit={submit}>
                <div {...stylex.props(styles.form)}>
                  <label {...stylex.props(styles.label)}>
                    Key
                    <input
                      type="text"
                      value={key()}
                      onInput={(e) => setKey(e.currentTarget.value)}
                      placeholder="e.g. newsletter.provider"
                      spellcheck={false}
                      disabled={editing() !== 'new'}
                      {...stylex.props(
                        styles.input,
                        ...(editing() === 'new' && key() && keyProblem() ? [styles.inputInvalid] : []),
                      )}
                      style={editing() !== 'new' ? { opacity: 0.5 } : undefined}
                    />
                    <Show when={editing() === 'new' && key().trim() && keyProblem()}>
                      <span {...stylex.props(styles.error)}>{keyProblem()}</span>
                    </Show>
                    <Show when={editing() === 'new' && key().trim().length > KEY_MAX}>
                      <span {...stylex.props(styles.hint)}>
                        Saved keys are matched case-insensitively, so `Newsletter.Provider` and
                        `newsletter.provider` are the same row.
                      </span>
                    </Show>
                  </label>
                  <Show when={duplicate()}>
                    <div {...stylex.props(styles.warn)}>
                      <span>
                        “{duplicate()!.key}” already exists in{' '}
                        <span {...stylex.props(s.badge)}>
                          {nodeLabel(duplicate()!.land, duplicate()!.colony, nodeLabels(), false)}
                        </span>
                        . Saving replaces its value and description — that is what{' '}
                        <span {...stylex.props(s.badge)}>PUT /api/_config/{"{"}key{"}"}</span> does.
                      </span>
                    </div>
                  </Show>
                  <Show
                    when={editing() !== 'new' || selectableColonies().length > 0}
                    // A session that cannot read the registry has exactly one colony it can
                    // write to — its own — so the core resolves it and there is nothing to pick.
                    fallback={
                      <label {...stylex.props(styles.label)}>
                        Colony
                        <input
                          type="text"
                          value={formColony() || 'your colony'}
                          disabled
                          {...stylex.props(styles.input)}
                        />
                        <span {...stylex.props(styles.hint)}>
                          The core writes this into the colony your session is bound to.
                        </span>
                      </label>
                    }
                  >
                    <label {...stylex.props(styles.label)}>
                      Colony
                      <select
                        value={formColony()}
                        disabled={editing() !== 'new'}
                        onChange={(e) => setFormColony(e.currentTarget.value)}
                        {...stylex.props(styles.select)}
                      >
                        <Show when={!formColony()}>
                          <option value="" selected>
                            Pick a colony…
                          </option>
                        </Show>
                        <For each={selectableColonies()}>
                          {(c) => (
                            <option value={c.id} selected={c.id === formColony()}>
                              {c.label} ({c.id})
                            </option>
                          )}
                        </For>
                      </select>
                      <Show when={colonyMustBeChosen() && !formColony()}>
                        <span {...stylex.props(styles.hint)}>
                          A key is stored once per colony, so a new entry needs one before it
                          can be saved.
                        </span>
                      </Show>
                    </label>
                  </Show>
                  <label {...stylex.props(styles.label)}>
                    Description
                    <input
                      type="text"
                      value={description()}
                      onInput={(e) => setDescription(e.currentTarget.value)}
                      placeholder="Optional"
                      spellcheck={false}
                      {...stylex.props(styles.input)}
                    />
                  </label>
                  <label {...stylex.props(styles.label)}>
                    Value (JSON)
                    <textarea
                      value={jsonText()}
                      onInput={(e) => setJsonText(e.currentTarget.value)}
                      rows={6}
                      spellcheck={false}
                      placeholder={'{ "your": "value" }'}
                      {...stylex.props(styles.textarea)}
                    />
                    <Show when={jsonError()}>
                      <span {...stylex.props(styles.error)}>{jsonError()}</span>
                    </Show>
                  </label>
                  <Show when={error()}>
                    <p {...stylex.props(styles.error)}>{error()}</p>
                  </Show>
                  <div {...stylex.props(styles.footer)}>
                    <button
                      type="submit"
                      disabled={
                        busy() ||
                        (editing() === 'new' && (!!keyProblem() || (colonyMustBeChosen() && !formColony())))
                      }
                      {...stylex.props(s.btn)}
                    >
                      {busy() ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} {...stylex.props(s.btn, s.btnGhost)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </Sheet>
          </Show>
        </Show>
      </Show>

      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.panel)}>
          <h2 {...stylex.props(styles.sectionHeading)}>Settings blob</h2>
          <p {...stylex.props(styles.sectionHint)}>
            One free-form JSON object in Cloudflare KV, under{' '}
            <span {...stylex.props(s.badge)}>settings:{'{land}:{colony}'}:v1</span>. Saving merges
            your top-level keys over what is stored — a key you delete here comes back, because
            the core only adds and overwrites. This is where{' '}
            <span {...stylex.props(s.badge)}>site.*</span> conventionally lives; a front end has
            to fetch <span {...stylex.props(s.badge)}>GET /api/_meta/settings</span> to read it,
            and nothing in the core reads it for you.
          </p>

          <Show
            when={canReadBlob()}
            fallback={
              <p {...stylex.props(styles.error)}>
                You need the “settings.read” permission to see the settings blob.
              </p>
            }
          >
            <Show
              when={!settings.isError}
              fallback={
                <div {...stylex.props(styles.notice)}>
                  <span>
                    Could not load the blob: {errorMessage(settings.error, 'the core refused the request')}
                  </span>
                  <button type="button" onClick={() => void settings.refetch()} {...stylex.props(s.btn, s.btnGhost)}>
                    Retry
                  </button>
                </div>
              }
            >
              <Show
                when={!settings.isPending && blobLoaded()}
                fallback={<p {...stylex.props(styles.empty)}>Loading settings…</p>}
              >
                <Show when={!canWriteBlob()}>
                  <div {...stylex.props(styles.warn)}>
                    <span>
                      Read-only: your session has “settings.read” but not “settings.write”, so
                      the core would reject a save.
                    </span>
                  </div>
                </Show>
                <Show when={blobEmpty()}>
                  <div {...stylex.props(styles.warn)}>
                    <span>The blob is empty.</span>
                    <button
                      type="button"
                      onClick={() => setJson(EXAMPLE_BLOB)}
                      disabled={!canWriteBlob()}
                      {...stylex.props(s.btn, s.btnGhost)}
                    >
                      Insert an example
                    </button>
                  </div>
                </Show>
                <form onSubmit={saveSettings}>
                  <JsonEditor
                    value={json}
                    onChange={setJson}
                    ariaLabel="Settings JSON"
                    rows={18}
                    readOnly={!canWriteBlob()}
                  />
                  <Show when={settingsError()}>
                    <p {...stylex.props(styles.error)}>{settingsError()}</p>
                  </Show>
                  <div {...stylex.props(styles.statusRow)}>
                    <Show when={canWriteBlob()}>
                      <button type="submit" disabled={settingsBusy() || !dirty()} {...stylex.props(s.btn)}>
                        {settingsBusy() ? 'Saving…' : 'Save'}
                      </button>
                    </Show>
                    <Show when={saved() && !dirty()}>
                      <span {...stylex.props(styles.status)}>Saved to KV.</span>
                    </Show>
                    <Show when={dirty()}>
                      <span {...stylex.props(styles.hint)}>Unsaved changes.</span>
                    </Show>
                  </div>
                </form>
              </Show>
            </Show>
          </Show>
        </div>
      </div>

      <div {...stylex.props(styles.section)}>
        <Show
          when={!isLegacyAdmin()}
          fallback={
            <p {...stylex.props(styles.hint)}>
              This session is the admin-key login, which has no password to change. Sign in as a
              user account to set one.
            </p>
          }
        >
          <div {...stylex.props(styles.panel)}>
            <h2 {...stylex.props(styles.sectionHeading)}>Change password</h2>
            <p {...stylex.props(styles.sectionHint)}>
              Update the password for your own account. Your current session stays signed in.
            </p>
            <form onSubmit={savePassword}>
              <div {...stylex.props(styles.form)}>
                <label {...stylex.props(styles.label)}>
                  Current password
                  <input
                    type="password"
                    value={currentPassword()}
                    onInput={(e) => setCurrentPassword(e.currentTarget.value)}
                    autocomplete="current-password"
                    spellcheck={false}
                    {...stylex.props(styles.input)}
                  />
                </label>
                <label {...stylex.props(styles.label)}>
                  New password
                  <input
                    type="password"
                    value={newPassword()}
                    onInput={(e) => setNewPassword(e.currentTarget.value)}
                    placeholder="At least 8 characters"
                    autocomplete="new-password"
                    spellcheck={false}
                    {...stylex.props(styles.input)}
                  />
                </label>
                <label {...stylex.props(styles.label)}>
                  Confirm new password
                  <input
                    type="password"
                    value={confirmPassword()}
                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                    autocomplete="new-password"
                    spellcheck={false}
                    {...stylex.props(styles.input)}
                  />
                </label>
              </div>
              <Show when={pwError()}>
                <p {...stylex.props(styles.error)}>{pwError()}</p>
              </Show>
              <Show when={pwSaved()}>
                <p {...stylex.props(styles.status)}>Password updated.</p>
              </Show>
              <div {...stylex.props(styles.footer)}>
                <button type="submit" disabled={pwBusy()} {...stylex.props(s.btn)}>
                  {pwBusy() ? 'Saving…' : 'Change password'}
                </button>
              </div>
            </form>
          </div>
        </Show>
      </div>
    </div>
  )
}
