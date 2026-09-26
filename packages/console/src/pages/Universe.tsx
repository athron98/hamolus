import { createQuery, useQueryClient } from '@tanstack/solid-query'
import { createSignal, For, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type {
  ColonyDto,
  ColonyDefinitionInput,
  LandDto,
  LandDefinitionInput,
  SuperAdminCreateInput,
  SuperAdminUpdateInput,
  SuperAdminUser,
} from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { api } from '../lib/api'
import { hasPermission, user } from '../lib/session'
import { logActivity } from '../lib/activity'
import { Sheet } from '../components/Sheet'
import { CheckIcon, GlobeIcon, PencilIcon, TrashIcon } from '../components/Icons'

const styles = stylex.create({
  setupBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: tokens.radius,
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
    fontSize: 13,
    fontWeight: 600,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color: tokens.text,
  },
  sectionCount: {
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
  },
  tableWrap: {
    marginTop: 10,
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
  mono: {
    fontFamily: tokens.fontMono,
    fontSize: 12,
  },
  dim: {
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
  defaultPill: {
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

type LandSheetState = LandDto | 'new' | null
type ColonySheetState = ColonyDto | 'new' | null
type SuperSheetState = SuperAdminUser | 'new' | null

export function UniversePage() {
  const queryClient = useQueryClient()

  // Must be declared before the queries below: createQuery evaluates its options
  // factory synchronously inside a createMemo, so referencing this const later
  // would hit the temporal dead zone and blank the whole page.
  // The super-admin directory is platform-level: the API refuses it to any
  // session that is not platform-scoped, so do not even ask for it.
  const isPlatformScope = () => user()?.privilegeScope === 'universe'

  const lands = createQuery(() => ({
    queryKey: ['lands'],
    queryFn: () => api.listLands().then((r) => r.data),
  }))
  const colonies = createQuery(() => ({
    queryKey: ['colonies'],
    queryFn: () => api.listColonies().then((r) => r.data),
  }))
  const supers = createQuery(() => ({
    queryKey: ['supers'],
    enabled: isPlatformScope,
    queryFn: () => api.listSupers().then((r) => r.data),
  }))

  const canWriteLands = () => hasPermission('lands.write')
  const canWriteColonies = () => hasPermission('colonies.write')

  const currentSuperId = () => (user()?.id.startsWith('super:') ? user()?.id.slice(6) : null)

  const [editingLand, setEditingLand] = createSignal<LandSheetState>(null)
  const [editingColony, setEditingColony] = createSignal<ColonySheetState>(null)
  const [editingSuper, setEditingSuper] = createSignal<SuperSheetState>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const invalidateRegistry = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['lands'] }),
      queryClient.invalidateQueries({ queryKey: ['colonies'] }),
      queryClient.invalidateQueries({ queryKey: ['supers'] }),
    ])
  }

  const coloniesFor = (landId: string) => colonies.data?.filter((c) => c.landId === landId) ?? []

  const removeLand = async (l: LandDto) => {
    if (!window.confirm(`Delete land "${l.id}"? All its collections, records, media and users will be removed.`)) return
    setError(null)
    try {
      await api.deleteLand(l.id)
      logActivity('land.delete', 'Deleted land', l.id)
      await invalidateRegistry()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete land')
    }
  }

  const removeColony = async (c: ColonyDto) => {
    if (!window.confirm(`Delete colony "${c.id}"? This cannot be undone.`)) return
    setError(null)
    try {
      await api.deleteColony(c.id, c.landId)
      logActivity('colony.delete', 'Deleted colony', `${c.landId}/${c.id}`)
      await invalidateRegistry()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete colony')
    }
  }

  const removeSuper = async (su: SuperAdminUser) => {
    if (su.id === currentSuperId()) {
      alert('You cannot delete your own super-admin session.')
      return
    }
    if (!window.confirm(`Delete super admin "${su.username}"? This cannot be undone.`)) return
    setError(null)
    try {
      await api.deleteSuper(su.id)
      logActivity('super.delete', 'Deleted super admin', su.username)
      await invalidateRegistry()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete super admin')
    }
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.row)}>
        <div>
          <h1 {...stylex.props(s.heading)}>
            <GlobeIcon size={18} />
            Universe
          </h1>
          <p {...stylex.props(s.subheading)}>
            Platform-level lands, colonies and global super-administrators.
          </p>
        </div>
        <Show when={canWriteLands() || canWriteColonies()}>
          <div style={{ 'margin-left': 'auto', display: 'flex', gap: '6px' }}>
            <Show when={canWriteLands()}>
              <button type="button" onClick={() => { setError(null); setEditingLand('new') }} {...stylex.props(s.btnGhost)}>
                New land
              </button>
            </Show>
            <Show when={canWriteColonies()}>
              <button type="button" onClick={() => { setError(null); setEditingColony('new') }} {...stylex.props(s.btnGhost)}>
                New colony
              </button>
            </Show>
            <Show when={canWriteLands()}>
              <button type="button" onClick={() => { setError(null); setEditingSuper('new') }} {...stylex.props(s.btn)}>
                New super admin
              </button>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={error()}>
        <p {...stylex.props(s.error)}>{error()}</p>
      </Show>

      {/* Lands */}
      <div {...stylex.props(styles.sectionHeader)}>
        <span {...stylex.props(styles.sectionTitle)}>Lands</span>
        <span {...stylex.props(styles.sectionCount)}>{lands.data?.length ?? '…'}</span>
      </div>
      <Show when={lands.data} fallback={<p {...stylex.props(s.muted)}>Loading lands…</p>}>
        <div {...stylex.props(styles.tableWrap)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>Land</th>
                <th {...stylex.props(styles.th)}>Label</th>
                <th {...stylex.props(styles.th)}>Description</th>
                <th {...stylex.props(styles.th)}>Colonies</th>
                <th {...stylex.props(styles.th)} />
              </tr>
            </thead>
            <tbody>
              <For
                each={lands.data ?? []}
                fallback={
                  <tr>
                    <td {...stylex.props(styles.td)} colSpan={5}>
                      <div {...stylex.props(styles.empty)}>No lands registered — the platform always has the default land.</div>
                    </td>
                  </tr>
                }
              >
                {(l) => (
                  <tr>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.pill, l.id === 'default' && styles.defaultPill)}>
                        {l.id}
                        {l.id === 'default' && <span style={{ color: 'inherit' }}> · default</span>}
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>{l.label}</td>
                    <td {...stylex.props(styles.td, styles.dim)}>{l.description ?? '—'}</td>
                    <td {...stylex.props(styles.td, styles.mono, styles.dim)}>{coloniesFor(l.id).length}</td>
                    <td {...stylex.props(styles.td)}>
                      <Show when={canWriteLands()}>
                        <div {...stylex.props(styles.actions)}>
                          <button type="button" onClick={() => { setError(null); setEditingLand(l) }} title={`Edit ${l.id}`} {...stylex.props(s.btnIcon, s.btnIconSm)}>
                            <PencilIcon size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLand(l)}
                            title={`Delete ${l.id}`}
                            disabled={l.id === 'default'}
                            {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
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

      {/* Colonies */}
      <div {...stylex.props(styles.sectionHeader)}>
        <span {...stylex.props(styles.sectionTitle)}>Colonies</span>
        <span {...stylex.props(styles.sectionCount)}>{colonies.data?.length ?? '…'}</span>
      </div>
      <Show when={colonies.data} fallback={<p {...stylex.props(s.muted)}>Loading colonies…</p>}>
        <div {...stylex.props(styles.tableWrap)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>Land</th>
                <th {...stylex.props(styles.th)}>Colony</th>
                <th {...stylex.props(styles.th)}>Label</th>
                <th {...stylex.props(styles.th)}>Description</th>
                <th {...stylex.props(styles.th)} />
              </tr>
            </thead>
            <tbody>
              <For
                each={colonies.data ?? []}
                fallback={
                  <tr>
                    <td {...stylex.props(styles.td)} colSpan={5}>
                      <div {...stylex.props(styles.empty)}>No colonies yet.</div>
                    </td>
                  </tr>
                }
              >
                {(c) => (
                  <tr>
                    <td {...stylex.props(styles.td, styles.mono, styles.dim)}>{c.landId}</td>
                    <td {...stylex.props(styles.td, styles.mono)}>{c.id}</td>
                    <td {...stylex.props(styles.td)}>{c.label}</td>
                    <td {...stylex.props(styles.td, styles.dim)}>{c.description ?? '—'}</td>
                    <td {...stylex.props(styles.td)}>
                      <Show when={canWriteColonies()}>
                        <div {...stylex.props(styles.actions)}>
                          <button type="button" onClick={() => { setError(null); setEditingColony(c) }} title={`Edit ${c.id}`} {...stylex.props(s.btnIcon, s.btnIconSm)}>
                            <PencilIcon size={13} />
                          </button>
                          <button type="button" onClick={() => removeColony(c)} title={`Delete ${c.id}`} {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}>
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

      <Show when={isPlatformScope()}>
        {/* Super admins */}
        <div {...stylex.props(styles.sectionHeader)}>
          <span {...stylex.props(styles.sectionTitle)}>Super admins</span>
          <span {...stylex.props(styles.sectionCount)}>{supers.data?.length ?? '…'}</span>
        </div>
        <Show when={supers.isLoading} fallback={null}>
          <p {...stylex.props(s.muted)}>Loading super admins…</p>
        </Show>
        <Show when={!supers.isLoading && supers.data?.length === 0}>
          <div {...stylex.props(styles.setupBanner)} style={{ 'margin-top': '10px' }}>
            No platform super admin exists yet. Create one here or set the
            SUPER_ADMIN_USERNAME/SUPER_ADMIN_PASSWORD env vars on first boot.
          </div>
        </Show>
        <Show when={supers.data && supers.data.length > 0}>
          <div {...stylex.props(styles.tableWrap)}>
            <table {...stylex.props(styles.table)}>
              <thead>
                <tr>
                  <th {...stylex.props(styles.th)}>Username</th>
                  <th {...stylex.props(styles.th)}>Name</th>
                  <th {...stylex.props(styles.th)}>Status</th>
                  <th {...stylex.props(styles.th)} />
                </tr>
              </thead>
              <tbody>
                <For each={supers.data ?? []}>
                  {(su) => (
                    <tr>
                      <td {...stylex.props(styles.td)}>
                        <span {...stylex.props(styles.mono)}>@{su.username}</span>
                        {su.id === currentSuperId() && <span {...stylex.props(styles.pill, styles.defaultPill)} style={{ 'margin-left': '8px' }}>(you)</span>}
                      </td>
                      <td {...stylex.props(styles.td)}>{su.name ?? '—'}</td>
                      <td {...stylex.props(styles.td)}>
                        <span {...stylex.props(styles.pill, su.isActive ? styles.activePill : styles.inactivePill)}>
                          {su.isActive ? 'Active' : 'Disabled'}
                          {su.isActive && <CheckIcon size={11} />}
                        </span>
                      </td>
                      <td {...stylex.props(styles.td)}>
                        <Show when={canWriteLands()}>
                          <div {...stylex.props(styles.actions)}>
                            <button type="button" onClick={() => { setError(null); setEditingSuper(su) }} title={`Edit ${su.username}`} {...stylex.props(s.btnIcon, s.btnIconSm)}>
                              <PencilIcon size={13} />
                            </button>
                            <button type="button" onClick={() => removeSuper(su)} title={`Delete ${su.username}`} {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}>
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

      {/* Land sheet */}
      <Show when={editingLand()}>
        <LandSheet
          target={editingLand() as LandSheetState}
          onClose={() => setEditingLand(null)}
          onError={setError}
        />
      </Show>

      {/* Colony sheet */}
      <Show when={editingColony()}>
        <ColonySheet
          target={editingColony() as ColonySheetState}
          lands={lands.data ?? []}
          onClose={() => setEditingColony(null)}
          onError={setError}
        />
      </Show>

      {/* Super admin sheet */}
      <Show when={editingSuper()}>
        <SuperSheet
          target={editingSuper() as SuperSheetState}
          onClose={() => setEditingSuper(null)}
          onError={setError}
        />
      </Show>
    </div>
  )
}

// ————————————————————————————— Land sheet —————————————————————————————

function LandSheet(props: { target: LandSheetState; onClose: () => void; onError: (m: string | null) => void }) {
  const queryClient = useQueryClient()
  const isNew = props.target === 'new'
  const land = isNew ? null : (props.target as LandDto)
  const [label, setLabel] = createSignal(land?.label ?? '')
  const [desc, setDesc] = createSignal(land?.description ?? '')
  const [id, setId] = createSignal(land?.id ?? '')
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    setBusy(true)
    setError(null)
    try {
      if (isNew) {
        const input: LandDefinitionInput = {
          id: id().trim(),
          label: label().trim(),
          description: desc().trim() || undefined,
        }
        await api.putLand(input.id, input)
        logActivity('land.create', 'Created land', input.id)
      } else {
        const input: LandDefinitionInput = {
          id: land!.id,
          label: label().trim(),
          description: desc().trim() || undefined,
        }
        await api.putLand(land!.id, input)
        logActivity('land.update', 'Updated land', land!.id)
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lands'] }),
        queryClient.invalidateQueries({ queryKey: ['colonies'] }),
      ])
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save land')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={isNew ? 'New land' : `Edit land · ${land?.id}`} onCloseRequest={async () => !busy()} onExited={props.onClose}>
      <form onSubmit={submit}>
        <div {...stylex.props(styles.form)}>
          <Show when={isNew}>
            <label {...stylex.props(s.label)}>
              Land id
              <input
                type="text"
                value={id()}
                onInput={(e) => setId(e.currentTarget.value)}
                placeholder="e.g. staging (snake_case, min 2 chars)"
                spellcheck={false}
                autocomplete="off"
                {...stylex.props(s.input)}
              />
            </label>
          </Show>
          <label {...stylex.props(s.label)}>
            Label
            <input type="text" value={label()} onInput={(e) => setLabel(e.currentTarget.value)} {...stylex.props(s.input)} />
          </label>
          <label {...stylex.props(s.label)}>
            Description
            <input type="text" value={desc()} onInput={(e) => setDesc(e.currentTarget.value)} placeholder="Optional" {...stylex.props(s.input)} />
          </label>
          <Show when={error()}>
            <p {...stylex.props(s.error)}>{error()}</p>
          </Show>
          <div {...stylex.props(styles.footer)}>
            <div {...stylex.props(styles.footerBtns)}>
              <button type="submit" disabled={busy()} {...stylex.props(s.btn)}>
                {busy() ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={props.onClose} {...stylex.props(s.btnGhost)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </Sheet>
  )
}

// ———————————————————————————— Colony sheet ————————————————————————————

function ColonySheet(props: {
  target: ColonySheetState
  lands: LandDto[]
  onClose: () => void
  onError: (m: string | null) => void
}) {
  const queryClient = useQueryClient()
  const isNew = props.target === 'new'
  const colony = isNew ? null : (props.target as ColonyDto)
  const [landId, setLandId] = createSignal(colony?.landId ?? '')
  const [id, setId] = createSignal(colony?.id ?? '')
  const [label, setLabel] = createSignal(colony?.label ?? '')
  const [desc, setDesc] = createSignal(colony?.description ?? '')
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    setBusy(true)
    setError(null)
    try {
      const input: ColonyDefinitionInput & { landId: string } = {
        id: id().trim(),
        landId: landId(),
        label: label().trim(),
        description: desc().trim() || undefined,
      }
      await api.putColony(input.id, input)
      logActivity(isNew ? 'colony.create' : 'colony.update', isNew ? 'Created colony' : 'Updated colony', `${input.landId}/${input.id}`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['colonies'] }),
      ])
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save colony')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={isNew ? 'New colony' : `Edit colony · ${colony?.id}`} onCloseRequest={async () => !busy()} onExited={props.onClose}>
      <form onSubmit={submit}>
        <div {...stylex.props(styles.form)}>
          <label {...stylex.props(s.label)}>
            Land
            <select value={landId()} onChange={(e) => setLandId(e.currentTarget.value)} {...stylex.props(s.select)}>
              <Show when={props.lands.length === 0} fallback={null}>
                <option value="">No lands available</option>
              </Show>
              <For each={props.lands}>
                {(l) => (
                  <option value={l.id} selected={l.id === landId()}>
                    {l.id} — {l.label}
                  </option>
                )}
              </For>
            </select>
          </label>
          <Show when={isNew}>
            <label {...stylex.props(s.label)}>
              Colony id
              <input
                type="text"
                value={id()}
                onInput={(e) => setId(e.currentTarget.value)}
                placeholder="e.g. warehouse (snake_case, min 2 chars)"
                spellcheck={false}
                autocomplete="off"
                {...stylex.props(s.input)}
              />
            </label>
          </Show>
          <label {...stylex.props(s.label)}>
            Label
            <input type="text" value={label()} onInput={(e) => setLabel(e.currentTarget.value)} {...stylex.props(s.input)} />
          </label>
          <label {...stylex.props(s.label)}>
            Description
            <input type="text" value={desc()} onInput={(e) => setDesc(e.currentTarget.value)} placeholder="Optional" {...stylex.props(s.input)} />
          </label>
          <Show when={error()}>
            <p {...stylex.props(s.error)}>{error()}</p>
          </Show>
          <div {...stylex.props(styles.footer)}>
            <div {...stylex.props(styles.footerBtns)}>
              <button type="submit" disabled={busy()} {...stylex.props(s.btn)}>
                {busy() ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={props.onClose} {...stylex.props(s.btnGhost)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </Sheet>
  )
}

// ——————————————————————————— Super admin sheet ————————————————————————————

function SuperSheet(props: {
  target: SuperSheetState
  onClose: () => void
  onError: (m: string | null) => void
}) {
  const queryClient = useQueryClient()
  const isNew = props.target === 'new'
  const su = isNew ? null : (props.target as SuperAdminUser)
  const [username, setUsername] = createSignal(su?.username ?? '')
  const [name, setName] = createSignal(su?.name ?? '')
  const [password, setPassword] = createSignal('')
  const [isActive, setIsActive] = createSignal(su?.isActive ?? true)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    setBusy(true)
    setError(null)
    try {
      if (isNew) {
        const input: SuperAdminCreateInput = {
          username: username().trim(),
          name: name().trim(),
          password: password(),
        }
        if (input.password.length < 8) throw new Error('Password must be at least 8 characters')
        await api.createSuper(input)
        logActivity('super.create', 'Created super admin', input.username)
      } else {
        const patch: SuperAdminUpdateInput = { name: name().trim(), isActive: isActive() }
        const pw = password().trim()
        if (pw) patch.password = pw
        if (su!.id === (user()?.id.startsWith('super:') ? user()?.id.slice(6) : null) && !isActive()) {
          throw new Error('You cannot disable your own super-admin session.')
        }
        await api.updateSuper(su!.id, patch)
        logActivity('super.update', 'Updated super admin', su!.username)
      }
      await queryClient.invalidateQueries({ queryKey: ['supers'] })
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save super admin')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={isNew ? 'New super admin' : `Edit super admin · @${su?.username}`} onCloseRequest={async () => !busy()} onExited={props.onClose}>
      <form onSubmit={submit}>
        <div {...stylex.props(styles.form)}>
          <p {...stylex.props(styles.dim)} style={{ 'font-size': '12px' }}>
            Super admins are global accounts outside any single land — they can
            manage the land registry and every land from this one session.
          </p>
          <Show when={isNew}>
            <label {...stylex.props(s.label)}>
              Username
              <input
                type="text"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                placeholder="e.g. platform_admin"
                spellcheck={false}
                autocomplete="off"
                {...stylex.props(s.input)}
              />
            </label>
          </Show>
          <label {...stylex.props(s.label)}>
            Display name
            <input type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} {...stylex.props(s.input)} />
          </label>
          <label {...stylex.props(s.label)}>
            Password
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder={isNew ? 'At least 8 characters' : 'Leave blank to keep current'}
              {...stylex.props(s.input)}
            />
          </label>
          <Show when={!isNew}>
            <label {...stylex.props(s.label)}>
              <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                <input type="checkbox" checked={isActive()} onChange={(e) => setIsActive(e.currentTarget.checked)} />
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
              <button type="button" onClick={props.onClose} {...stylex.props(s.btnGhost)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </Sheet>
  )
}