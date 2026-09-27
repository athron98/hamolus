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
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { ConfigEntry, ConfigEntryInput, ConfigScope } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { api } from '../lib/api'
import { hasPermission } from '../lib/session'
import { logActivity } from '../lib/activity'
import { Sheet } from '../components/Sheet'
import { JsonEditor } from '../components/JsonEditor'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { user } from '../lib/session'

const SCOPES: ConfigScope[] = ['core', 'console', 'site']

const DEFAULT_JSON = JSON.stringify(
  {
    site: {
      name: 'Hamolus',
      tagline: 'A Cloudflare Workers monorepo: core API, admin console, public site',
      navigation: [{ label: 'Home', href: '/' }, { label: 'Posts', href: '/posts' }],
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
  tableWrap: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 560,
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
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.textDim,
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
  scopeCore: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  scopeConsole: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
  scopeSite: {
    color: tokens.text,
    backgroundColor: tokens.surfaceRaised,
  },
  scopeEmpty: {
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
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
  panel: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    padding: 20,
    maxWidth: 720,
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
  btn: {
    backgroundColor: tokens.accent,
    color: '#fff',
    borderRadius: tokens.radiusSm,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    borderStyle: 'none',
    cursor: 'pointer',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    color: tokens.textDim,
    borderRadius: tokens.radiusSm,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    borderStyle: 'none',
    cursor: 'pointer',
  },
  btnIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: tokens.radiusSm,
    color: tokens.textDim,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    cursor: 'pointer',
  },
  btnIconSm: {
    width: 26,
    height: 26,
  },
  btnIconDanger: {
    color: tokens.danger,
  },
  status: {
    fontSize: 13,
    color: tokens.ok,
  },
  error: {
    fontSize: 13,
    color: tokens.danger,
  },
})

function scopePill(scope: ConfigScope) {
  if (scope === 'core') return styles.scopeCore
  if (scope === 'console') return styles.scopeConsole
  return styles.scopeSite
}

function stringifyValue(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') {
    return v.length > 60 ? `${v.slice(0, 60)}…` : v
  }
  try {
    const s = JSON.stringify(v)
    return s && s.length > 60 ? `${s.slice(0, 60)}…` : s ?? 'undefined'
  } catch {
    return String(v)
  }
}

export function ConfigPage() {
  const queryClient = useQueryClient()
  const configs = createQuery(() => ({
    queryKey: ['config'],
    queryFn: () => api.listConfigs().then((r) => r.data),
  }))

  const [editing, setEditing] = createSignal<ConfigEntry | 'new' | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const [key, setKey] = createSignal('')
  const [scope, setScope] = createSignal<ConfigScope>('core')
  const [description, setDescription] = createSignal('')
  const [jsonText, setJsonText] = createSignal('')
  const [jsonError, setJsonError] = createSignal<string | null>(null)

  const canWrite = () => hasPermission('config.write')

  const openNew = () => {
    setError(null)
    setKey('')
    setScope('core')
    setDescription('')
    setJsonText('null')
    setJsonError(null)
    setEditing('new')
  }

  const openEdit = (entry: ConfigEntry) => {
    setError(null)
    setKey(entry.key)
    setScope(entry.scope)
    setDescription(entry.description ?? '')
    setJsonText(JSON.stringify(entry.value, null, 2))
    setJsonError(null)
    setEditing(entry)
  }

  const parseValue = (): { ok: true; value: unknown } | { ok: false; message: string } => {
    try {
      return { ok: true, value: JSON.parse(jsonText()) }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Invalid JSON' }
    }
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    const parsed = parseValue()
    if (!parsed.ok) {
      setJsonError(parsed.message)
      return
    }
    setBusy(true)
    setError(null)
    setJsonError(null)
    try {
      const input: ConfigEntryInput = {
        key: key().trim(),
        value: parsed.value,
        scope: scope(),
        description: description().trim() || null,
      }
      const isNew = editing() === 'new'
      const updating = editing() && editing() !== 'new' ? (editing() as ConfigEntry) : null
      if (isNew || updating) {
        await api.putConfig(input.key, input)
        logActivity(
          isNew ? 'config.create' : 'config.update',
          isNew ? 'Created config' : 'Updated config',
          input.key,
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['config'] })
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (entry: ConfigEntry) => {
    if (!window.confirm(`Delete config "${entry.key}"?`)) return
    try {
      await api.deleteConfig(entry.key)
      logActivity('config.delete', 'Deleted config', entry.key)
      await queryClient.invalidateQueries({ queryKey: ['config'] })
      if (editing() === entry) setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete config')
    }
  }

  // ---- Folded-in Settings page (KV blob editor + change password) ----
  const isLegacyAdmin = () =>
    user() !== null && user()!.id === 'admin' && user()!.privilegeName === 'admin'

  const [json, setJson] = createSignal(DEFAULT_JSON)
  const [settingsError, setSettingsError] = createSignal<string | null>(null)
  const [saved, setSaved] = createSignal(false)
  const [settingsBusy, setSettingsBusy] = createSignal(false)

  const [currentPassword, setCurrentPassword] = createSignal('')
  const [newPassword, setNewPassword] = createSignal('')
  const [confirmPassword, setConfirmPassword] = createSignal('')
  const [pwError, setPwError] = createSignal<string | null>(null)
  const [pwSaved, setPwSaved] = createSignal(false)
  const [pwBusy, setPwBusy] = createSignal(false)

  const saveSettings = async (e: Event) => {
    e.preventDefault()
    if (settingsBusy()) return
    let parsed: unknown
    try {
      parsed = JSON.parse(json())
    } catch {
      setSettingsError('Settings must be valid JSON')
      return
    }
    setSettingsBusy(true)
    setSettingsError(null)
    try {
      await api.putSettings(parsed as Record<string, unknown>)
      logActivity('settings.update', 'Updated settings')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSettingsBusy(false)
    }
  }

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
      setPwError(err instanceof Error ? err.message : 'Failed to change password')
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
            Environment-scoped key/value settings consumed by the core, console and site.
            The site settings blob below is stored in Cloudflare KV.
          </p>
        </div>
        <Show when={canWrite()}>
          <div style={{ 'margin-left': 'auto' }}>
            <button type="button" onClick={openNew} title="New config" {...stylex.props(styles.btnIcon)}>
              <PlusIcon size={15} />
            </button>
          </div>
        </Show>
      </div>

      <Show when={configs.data} fallback={<p {...stylex.props(styles.empty)}>Loading config…</p>}>
        <Show
          when={(configs.data ?? []).length > 0}
          fallback={<p {...stylex.props(styles.empty)}>No config entries yet.</p>}
        >
          <div {...stylex.props(styles.tableWrap)}>
            <table {...stylex.props(styles.table)}>
              <thead>
                <tr>
                  <th {...stylex.props(styles.th)}>Key</th>
                  <th {...stylex.props(styles.th)}>Scope</th>
                  <th {...stylex.props(styles.th)}>Value</th>
                  <th {...stylex.props(styles.th)}>Description</th>
                  <th {...stylex.props(styles.th)} />
                </tr>
              </thead>
              <tbody>
                <For each={configs.data ?? []}>
                  {(entry) => (
                    <tr>
                      <td {...stylex.props(styles.td, styles.keyCell)}>{entry.key}</td>
                      <td {...stylex.props(styles.td)}>
                        <span {...stylex.props(styles.pill, scopePill(entry.scope))}>
                          {entry.scope}
                        </span>
                      </td>
                      <td {...stylex.props(styles.td, styles.valueCell)}>
                        {stringifyValue(entry.value)}
                      </td>
                      <td {...stylex.props(styles.td, styles.descCell)}>
                        {entry.description ?? '—'}
                      </td>
                      <td {...stylex.props(styles.td)}>
                        <Show when={canWrite()}>
                          <div {...stylex.props(styles.actions)}>
                            <button
                              type="button"
                              onClick={() => openEdit(entry)}
                              title={`Edit ${entry.key}`}
                              {...stylex.props(styles.btnIcon, styles.btnIconSm)}
                            >
                              <PencilIcon size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(entry)}
                              title={`Delete ${entry.key}`}
                              {...stylex.props(styles.btnIcon, styles.btnIconSm, styles.btnIconDanger)}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </div>
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>

      <Show when={editing()}>
        <Sheet
          title={
            editing() === 'new' ? 'New config' : `Edit ${(editing() as ConfigEntry).key}`
          }
          onCloseRequest={async () => true}
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
                  placeholder="e.g. site.name"
                  spellcheck={false}
                  disabled={editing() !== 'new'}
                  {...stylex.props(styles.input)}
                  style={editing() !== 'new' ? { opacity: 0.5 } : undefined}
                />
              </label>
              <label {...stylex.props(styles.label)}>
                Scope
                <select
                  value={scope()}
                  onChange={(e) => setScope(e.currentTarget.value as ConfigScope)}
                  {...stylex.props(styles.select)}
                >
                  <For each={SCOPES}>
                    {(sc) => (
                      <option value={sc} selected={sc === scope()}>
                        {sc}
                      </option>
                    )}
                  </For>
                </select>
              </label>
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
                  {...stylex.props(styles.textarea)}
                />
                <Show when={jsonError()}>
                  <p {...stylex.props(styles.error)}>{jsonError()}</p>
                </Show>
              </label>
              <Show when={error()}>
                <p {...stylex.props(styles.error)}>{error()}</p>
              </Show>
              <div {...stylex.props(styles.footer)}>
                <button type="submit" disabled={busy()} {...stylex.props(styles.btn)}>
                  {busy() ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditing(null)} {...stylex.props(styles.btnGhost)}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </Sheet>
      </Show>

      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.panel)}>
          <h2 {...stylex.props(styles.sectionHeading)}>Settings</h2>
          <p {...stylex.props(styles.sectionHint)}>
            Free-form JSON stored as a single KV blob, consumed by the public site.
          </p>
          <form onSubmit={saveSettings}>
            <JsonEditor value={json} onChange={setJson} ariaLabel="Settings JSON" />
            <Show when={settingsError()}>
              <p {...stylex.props(styles.error)}>{settingsError()}</p>
            </Show>
            <Show when={saved()}>
              <p {...stylex.props(styles.status)}>Saved to KV.</p>
            </Show>
            <div {...stylex.props(styles.footer)}>
              <button type="submit" disabled={settingsBusy()} {...stylex.props(styles.btn)}>
                {settingsBusy() ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.panel)}>
          <Show when={!isLegacyAdmin()}>
            <h2 {...stylex.props(styles.sectionHeading)}>Change password</h2>
            <p {...stylex.props(styles.sectionHint)}>
              Update the password for your own account.
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
                <button type="submit" disabled={pwBusy()} {...stylex.props(styles.btn)}>
                  {pwBusy() ? 'Saving…' : 'Change password'}
                </button>
              </div>
            </form>
          </Show>
        </div>
      </div>
    </div>
  )
}
