import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type { AuthUser, AuthUserCreateInput, AuthUserUpdateInput } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { api } from '../lib/api'
import { hasPermission, user } from '../lib/session'
import { logActivity } from '../lib/activity'
import { Sheet } from '../components/Sheet'
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'

interface PrivilegeOption {
  id: string
  name: string
  label: string
}

const styles = stylex.create({
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
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  avatar: {
    width: 26,
    height: 26,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    fontSize: 11,
    fontWeight: 800,
  },
  mainName: {
    fontWeight: 600,
    color: tokens.text,
  },
  username: {
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
  },
  rolePill: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  activePill: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
  inactivePill: {
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
  },
  me: {
    color: tokens.textDim,
    fontSize: 10,
    fontFamily: tokens.fontMono,
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
    maxWidth: 420,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  footerBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
})

function initials(name: string | null, username: string): string {
  const src = (name ?? username).trim()
  return src.slice(0, 2).toUpperCase()
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const users = createQuery(() => ({
    queryKey: ['users'],
    queryFn: () => api.listUsers().then((r) => r.data),
  }))
  const privileges = createQuery(() => ({
    queryKey: ['privileges'],
    queryFn: () =>
      api.listRecords('privileges', { page: 1, pageSize: 100, sortDir: 'asc' }).then((r) => r.data),
  }))

  const [editing, setEditing] = createSignal<AuthUser | 'new' | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  // Form state (reset when editing changes)
  const [username, setUsername] = createSignal('')
  const [name, setName] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [privilegeId, setPrivilegeId] = createSignal('')
  const [isActive, setIsActive] = createSignal(true)

  const privilegeOptions = (): PrivilegeOption[] =>
    (privileges.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      label: p.label as string,
    }))

  const privilegeName = (privId: string): string =>
    privilegeOptions().find((p) => p.id === privId)?.label ?? privId

  const openNew = () => {
    setError(null)
    setUsername('')
    setName('')
    setPassword('')
    const first = privilegeOptions()[0]
    setPrivilegeId(first ? first.id : '')
    setIsActive(true)
    setEditing('new')
  }

  const openEdit = (u: AuthUser) => {
    setError(null)
    setUsername(u.username)
    setName(u.name ?? '')
    setPassword('')
    setPrivilegeId(u.privilegeId)
    setIsActive(u.isActive)
    setEditing(u)
  }

  const canWrite = () => hasPermission('users.write')

  const submit = async (e: Event) => {
    e.preventDefault()
    const target = editing()
    if (busy() || !target) return
    setBusy(true)
    setError(null)
    try {
      if (target === 'new') {
        const input: AuthUserCreateInput = {
          username: username().trim(),
          name: name().trim(),
          password: password(),
          privilegeId: privilegeId(),
          isActive: isActive(),
        }
        if (input.password.length < 8) throw new Error('Password must be at least 8 characters')
        await api.createUser(input)
        logActivity('user.create', 'Created user', input.username)
      } else {
        const patch: AuthUserUpdateInput = {
          name: name().trim(),
          privilegeId: privilegeId(),
          isActive: isActive(),
        }
        const pw = password().trim()
        if (pw) patch.password = pw
        await api.updateUser(target.id, patch)
        logActivity('user.update', 'Updated user', target.username)
      }
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (u: AuthUser) => {
    if (!window.confirm(`Delete user "${u.username}"? This cannot be undone.`)) return
    try {
      await api.deleteUser(u.id)
      logActivity('user.delete', 'Deleted user', u.username)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      if (editing() === u) setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.row)}>
        <div>
          <h1 {...stylex.props(s.heading)}>Users</h1>
          <p {...stylex.props(s.subheading)}>Manage accounts that can sign in to this console.</p>
        </div>
        <Show when={canWrite()}>
          <div style={{ 'margin-left': 'auto' }}>
            <button type="button" onClick={openNew} {...stylex.props(s.btnIcon)} title="New user">
              <PlusIcon size={15} />
            </button>
          </div>
        </Show>
      </div>

      <Show
        when={users.data}
        fallback={<p {...stylex.props(s.muted)}>Loading users…</p>}
      >
        <div {...stylex.props(styles.tableWrap)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>User</th>
                <th {...stylex.props(styles.th)}>Role</th>
                <th {...stylex.props(styles.th)}>Status</th>
                <th {...stylex.props(styles.th)} />
              </tr>
            </thead>
            <tbody>
              <For
                each={users.data ?? []}
                fallback={
                  <tr>
                    <td {...stylex.props(styles.td)} colSpan={4}>
                      <div {...stylex.props(styles.empty)}>No users yet.</div>
                    </td>
                  </tr>
                }
              >
                {(u) => (
                  <tr>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.name)}>
                        <span {...stylex.props(styles.avatar)}>{initials(u.name, u.username)}</span>
                        <span>
                          <span {...stylex.props(styles.mainName)}>
                            {u.name ?? u.username}
                            {u.id === user()?.id && ' '}
                            {u.id === user()?.id && <span {...stylex.props(styles.me)}>(you)</span>}
                          </span>
                          <div {...stylex.props(styles.username)}>@{u.username}</div>
                        </span>
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.pill, styles.rolePill)}>
                        {u.privilegeLabel ?? u.privilegeName ?? '—'}
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.pill, u.isActive ? styles.activePill : styles.inactivePill)}>
                        {u.isActive ? 'Active' : 'Disabled'}
                        {u.isActive && <CheckIcon size={11} />}
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <Show when={canWrite()}>
                        <div {...stylex.props(styles.actions)}>
                          <button type="button" onClick={() => openEdit(u)} title={`Edit ${u.username}`} {...stylex.props(s.btnIcon, s.btnIconSm)}>
                            <PencilIcon size={13} />
                          </button>
                          <button type="button" onClick={() => remove(u)} title={`Delete ${u.username}`} {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}>
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

      <Show when={editing()}>
        <Sheet
          title={editing() === 'new' ? 'New user' : `Edit ${name() || (editing() as AuthUser).username}`}
          onCloseRequest={async () => true}
          onExited={() => setEditing(null)}
        >
          <form onSubmit={submit}>
            <div {...stylex.props(styles.form)}>
              <Show when={editing() === 'new'}>
                <label {...stylex.props(s.label)}>
                  Username
                  <input
                    type="text"
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                    placeholder="lowercase_letters_digits"
                    spellcheck={false}
                    autocomplete="off"
                    {...stylex.props(s.input)}
                  />
                </label>
              </Show>
              <label {...stylex.props(s.label)}>
                Display name
                <input
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  spellcheck={false}
                  {...stylex.props(s.input)}
                />
              </label>
              <label {...stylex.props(s.label)}>
                Password
                <input
                  type="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  placeholder={editing() === 'new' ? 'At least 8 characters' : 'Leave blank to keep current'}
                  {...stylex.props(s.input)}
                />
              </label>
              <label {...stylex.props(s.label)}>
                Role
                <select
                  value={privilegeId()}
                  onChange={(e) => setPrivilegeId(e.currentTarget.value)}
                  {...stylex.props(s.select)}
                >
                  <Show
                    when={privilegeOptions().length > 0}
                    fallback={<option value="">No roles available</option>}
                  >
                    <For each={privilegeOptions()}>
                      {(p) => (
                        <option value={p.id} selected={p.id === privilegeId()}>
                          {p.label} · {p.name}
                        </option>
                      )}
                    </For>
                  </Show>
                </select>
              </label>
              <Show when={editing() !== 'new'}>
                <label {...stylex.props(s.label)}>
                  <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={isActive()}
                      onChange={(e) => setIsActive(e.currentTarget.checked)}
                    />
                    Account active
                  </span>
                </label>
              </Show>
              <Show when={error()}>
                <p {...stylex.props(s.error)}>{error()}</p>
              </Show>
              <div {...stylex.props(styles.footer)}>
                <div {...stylex.props(styles.footerBtns)}>
                  <button type="submit" disabled={busy()} {...stylex.props(s.btn)}>
                    {busy() ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    {...stylex.props(s.btnGhost)}
                  >
                    Cancel
                  </button>
                </div>
                <Show when={editing() !== 'new' && canWrite()}>
                  <button
                    type="button"
                    onClick={() => remove(editing() as AuthUser)}
                    {...stylex.props(s.btnDanger)}
                  >
                    Delete
                  </button>
                </Show>
              </div>
            </div>
          </form>
        </Sheet>
      </Show>
    </div>
  )
}