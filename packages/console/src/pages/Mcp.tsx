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
import { createSignal, For, Show, createMemo } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import type {
  McpInstance,
  McpInstanceCreateInput,
  McpToken,
  McpTokenCreateInput,
  McpToolGroup,
  Permission,
} from '@hamolus/types'
import { DEFAULT_MCP_TOOL_GROUPS, MCP_GROUP_PERMISSIONS, MCP_TOOL_GROUPS, mcpPermissions } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { api } from '../lib/api'
import { hasPermission, hydrated, user } from '../lib/session'
import { apiBase, colony, land } from '../lib/store'
import { logActivity } from '../lib/activity'
import { Sheet } from '../components/Sheet'
import { CheckIcon, CopyIcon, KeyIcon, PencilIcon, PlusIcon, TrashIcon, XIcon, ZapIcon } from '../components/Icons'

/**
 * MCP instance administration — the whole configuration surface, in one page.
 *
 * A deployed MCP worker holds two variables: where the core is, and which instance
 * it is. Everything that decides what that instance may *do* — the colony it serves,
 * whether it may write, which tool groups it offers, and which tokens may call it —
 * is a row in the core, and this page is where that row is edited. That is the whole
 * point of the feature: a scope change is a console action, not a redeploy.
 *
 * Two things are deliberately *not* editable here, and both are explained in the UI
 * rather than hidden:
 *
 * - The instance id. It is the worker's credential, so it is generated on create and
 *   shown once with the deployment snippet to paste. A field to retype it would invite
 *   a typo that silently locks the deployment out of its own configuration.
 * - Token secrets. The core stores only a hash, so a lost token is reissued, never
 *   recovered. The reveal panel is therefore the single chance to copy it.
 */

const styles = stylex.create({
  intro: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 18,
    padding: '12px 14px',
    borderRadius: tokens.radius,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    fontSize: 13,
    color: tokens.textDim,
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
  labelCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  labelMain: {
    fontWeight: 600,
  },
  labelSub: {
    fontFamily: tokens.fontMono,
    fontSize: 11,
    color: tokens.textDim,
  },
  pillRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    'align-items': 'center',
    gap: 5,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: tokens.radiusSm,
    whiteSpace: 'nowrap',
  },
  okPill: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
  dimPill: {
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
  },
  accentPill: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  /**
   * Reserved for an instance that is switched off.
   *
   * A disabled instance was previously drawn in `dimPill`, which is the same
   * neutral as the "Read/write" tag beside it — so on screen a server that refuses
   * every request looked exactly like an ordinary one, and the only thing separating
   * them was reading the word. That is the wrong way round: "this deployment is not
   * serving" is the one fact an operator scans this table for, and it should cost a
   * deliberate glance rather than survive as a detail.
   */
  offPill: {
    color: tokens.danger,
    backgroundColor: tokens.dangerSoft,
    // A disabled instance is also the one state where a bare colour could be
    // misread as a hover or focus tint, so mark it structurally too.
    textDecoration: 'line-through',
  },
  groupRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  groupChip: {
    padding: '1px 6px',
    fontSize: 10,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
    backgroundColor: tokens.surfaceRaised,
    borderRadius: 4,
  },
  actions: {
    display: 'flex',
    'align-items': 'center',
    gap: 4,
    'justify-content': 'flex-end',
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
    maxWidth: 480,
  },
  groupPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  groupOption: {
    display: 'flex',
    'align-items': 'flex-start',
    gap: 8,
    padding: '8px 10px',
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.surfaceRaised,
    cursor: 'pointer',
  },
  groupOptionOn: {
    boxShadow: `inset 0 0 0 1px ${tokens.accentBold}`,
  },
  groupText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  groupName: {
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
  },
  groupBlast: {
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
  },
  footer: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    paddingTop: 4,
  },
  footerBtns: {
    display: 'flex',
    'align-items': 'center',
    gap: 8,
  },
  // The reveal panel. Deliberately loud: this is the only copy of the secret, and a
  // quiet field here is how a token gets lost and reissued ten minutes later.
  reveal: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    borderRadius: tokens.radius,
    backgroundColor: tokens.accentSoft,
    boxShadow: `inset 0 0 0 1px ${tokens.accentBold}`,
  },
  revealWarn: {
    fontSize: 12,
    fontWeight: 600,
    color: tokens.text,
  },
  secret: {
    padding: '8px 10px',
    fontFamily: tokens.fontMono,
    fontSize: 12,
    wordBreak: 'break-all',
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusSm,
    color: tokens.text,
  },
  perms: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 190,
    overflowY: 'auto',
    padding: 10,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.surfaceRaised,
  },
  permRow: {
    display: 'flex',
    'align-items': 'center',
    gap: 8,
    fontSize: 12,
    fontFamily: tokens.fontMono,
    color: tokens.text,
  },
  permWrite: {
    color: tokens.accent,
  },
  sheetBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: tokens.textDim,
    margin: 0,
  },
  tokensTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tokenName: {
    fontWeight: 600,
  },
  tokenPerms: {
    fontSize: 11,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
  },
  hint: {
    fontSize: 11,
    color: tokens.textDim,
    lineHeight: 1.5,
  },
})

/** One line describing what a group costs, taken from the core ACL it maps to. */
function blastRadius(group: McpToolGroup, readonly: boolean): string {
  const perms = mcpPermissions({ toolGroups: [group], readonly })
  if (perms.length === 0) return 'nothing while read-only'
  return perms.join(' ')
}

function groupLabel(group: McpToolGroup): string {
  return group === 'records' ? 'Records' : group === 'media' ? 'Media' : group === 'meta' ? 'Meta' : 'Admin'
}

/** What the group *could* reach, for the create form before a token narrows it. */
const ALL_GROUP_PERMISSIONS: readonly Permission[] = Array.from(
  new Set(MCP_TOOL_GROUPS.flatMap((g) => [...MCP_GROUP_PERMISSIONS[g].read, ...MCP_GROUP_PERMISSIONS[g].write])),
).sort()

function copy(text: string): void {
  void navigator.clipboard?.writeText(text)
}

/**
 * How stale a heartbeat is, in the three states an operator actually acts on.
 *
 * The threshold is the worker's own `CONFIG_TTL_MS` (60s) doubled, not a round number
 * chosen for looks: a deployment polls its config about once a minute, so anything past
 * a couple of minutes means the worker stopped reaching this core rather than that it
 * was slow. `never` is kept separate from `stale` on purpose — a row that has never been
 * contacted is a deployment that was never finished, and reading that as "went offline"
 * sends someone looking for a network problem that does not exist.
 */
type Presence = 'never' | 'live' | 'stale'

function presence(lastSeenAt: string | null): Presence {
  if (!lastSeenAt) return 'never'
  const at = Date.parse(lastSeenAt)
  if (Number.isNaN(at)) return 'never'
  return Date.now() - at > 2 * 60 * 1000 ? 'stale' : 'live'
}

const PRESENCE_LABEL: Record<Presence, string> = {
  never: 'Never contacted',
  live: 'Live',
  stale: 'No contact for a while',
}

/** Compact age, for a table cell. Falls back to the absolute date past a week. */
function ageLabel(lastSeenAt: string | null): string {
  const at = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN
  if (Number.isNaN(at)) return '—'
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(at).toISOString().slice(0, 10)
}

export function McpPage() {
  const queryClient = useQueryClient()

  /** The scope this page manages: the endpoint's colony, or a land admin's own land. */
  const target = createMemo(() => ({ land: land(), colony: colony() }))

/**
 * The `CORE_API_URL` to hand the operator.
 *
 * This has to be the URL the console is *actually talking to*, not a placeholder. A
 * `your-core.example.com` in a copy-paste block is worse than no snippet at all: the
 * failure only shows up as a 404 from the new worker, minutes later, on a machine the
 * operator is no longer looking at. An empty `apiBase()` means the console is served
 * from the core itself, so the same origin plus `/api` is the honest answer.
 */
const coreUrl = () => {
  const base = apiBase().trim()
  return base || `${window.location.origin}/api`
}

  const canRead = () => hasPermission('mcp.read')
  const canWrite = () => hasPermission('mcp.write')

  const instances = createQuery(() => ({
    queryKey: ['mcp-instances', user()?.id ?? 'anonymous', target().land, target().colony],
    queryFn: () => api.listMcpInstances(target()).then((r) => r.data),
    enabled: hydrated() && canRead(),
  }))

  const [editing, setEditing] = createSignal<McpInstance | 'new' | null>(null)
  const [managingTokens, setManagingTokens] = createSignal<McpInstance | null>(null)
  const [issued, setIssued] = createSignal<{ name: string; token: string } | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [pendingDelete, setPendingDelete] = createSignal<McpInstance | null>(null)

  // Instance form state.
  const [label, setLabel] = createSignal('')
  const [enabled, setEnabled] = createSignal(true)
  const [readonly, setReadonly] = createSignal(false)
  const [groups, setGroups] = createSignal<McpToolGroup[]>([...DEFAULT_MCP_TOOL_GROUPS])
  const [dynamicTools, setDynamicTools] = createSignal('all')
  const [dynamicMax, setDynamicMax] = createSignal(25)

  // Token form state.
  const [tokenName, setTokenName] = createSignal('')
  const [tokenPerms, setTokenPerms] = createSignal<Permission[]>([])
  const [expiresIn, setExpiresIn] = createSignal('')

  const openNew = () => {
    setError(null)
    setLabel('')
    setEnabled(true)
    setReadonly(false)
    setGroups([...DEFAULT_MCP_TOOL_GROUPS])
    setDynamicTools('all')
    setDynamicMax(25)
    setEditing('new')
  }

  const openEdit = (inst: McpInstance) => {
    setError(null)
    setLabel(inst.label)
    setEnabled(inst.enabled)
    setReadonly(inst.readonly)
    setGroups([...inst.toolGroups])
    setDynamicTools(inst.dynamicTools)
    setDynamicMax(inst.dynamicMax)
    setEditing(inst)
  }

  const toggleGroup = (group: McpToolGroup) => {
    setGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    )
  }

  /** The permission set the *instance* grants, shown live under the group picker. */
  const effectivePermissions = createMemo(() =>
    mcpPermissions({ toolGroups: groups(), readonly: readonly() }),
  )

  const submit = async (e: Event) => {
    e.preventDefault()
    const targetInstance = editing()
    if (busy() || !targetInstance) return
    if (groups().length === 0) {
      setError('Pick at least one tool group — an instance with no groups can authorize nothing.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (targetInstance === 'new') {
        // No land/colony in the body: the core resolves the instance's colony from
        // `target()` and the session's privilege, and accepting both would mean two
        // sources for one fact.
        const input: McpInstanceCreateInput = {
          label: label().trim(),
          enabled: enabled(),
          readonly: readonly(),
          toolGroups: groups(),
          dynamicTools: dynamicTools().trim(),
          dynamicMax: dynamicMax(),
        }
        const res = await api.createMcpInstance(input, target())
        logActivity('mcp.instance.create', 'Created MCP instance', input.label)
        setEditing(null)
        await queryClient.invalidateQueries({ queryKey: ['mcp-instances'] })
        // The id is the credential and the deployment needs it, so surface it straight
        // away rather than making the operator hunt for it in a table.
        setIssued({
          name: res.data.label,
          token: ['', `CORE_API_URL=${coreUrl()}`, `MCP_INSTANCE_ID=${res.data.id}`].join('\n'),
        })
      } else {
        await api.updateMcpInstance(
          targetInstance.id,
          {
            label: label().trim(),
            enabled: enabled(),
            readonly: readonly(),
            toolGroups: groups(),
            dynamicTools: dynamicTools().trim(),
            dynamicMax: dynamicMax(),
          },
          target(),
        )
        logActivity('mcp.instance.update', 'Updated MCP instance', label().trim())
        setEditing(null)
        await queryClient.invalidateQueries({ queryKey: ['mcp-instances'] })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save instance')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (inst: McpInstance) => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteMcpInstance(inst.id, target())
      logActivity('mcp.instance.delete', 'Deleted MCP instance', inst.label)
      setPendingDelete(null)
      setEditing(null)
      setManagingTokens(null)
      await queryClient.invalidateQueries({ queryKey: ['mcp-instances'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete instance')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.row)}>
        <div>
          <h1 {...stylex.props(s.heading)}>MCP</h1>
          <p {...stylex.props(s.subheading)}>
            Configure an MCP server without redeploying it, and see which release is
            actually deployed behind each instance.
          </p>
        </div>
        <Show when={canWrite()}>
          <div style={{ 'margin-left': 'auto' }}>
            <button type="button" onClick={openNew} {...stylex.props(s.btnIcon)} title="New instance">
              <PlusIcon size={15} />
            </button>
          </div>
        </Show>
      </div>

      <div {...stylex.props(styles.intro)}>
        <span>
          A deployed MCP server holds <strong>two</strong> values: the core URL and its
          instance id. Scope, read/write, tool groups and tokens are stored in the core
          and read on every request — so changing anything below takes effect within a
          minute, with no redeploy and no secret to rotate.
        </span>
      </div>

      <Show when={error() && !editing() && !managingTokens()}>
        <p {...stylex.props(s.error)}>{error()}</p>
      </Show>

      <Show when={issued()}>
        <div {...stylex.props(styles.reveal)}>
          <span {...stylex.props(styles.revealWarn)}>
            {issued()!.token.startsWith('CORE_API_URL') ? 'Deployment values — shown once' : 'Token — shown once'}
          </span>
          <code {...stylex.props(styles.secret)}>{issued()!.token}</code>
          <div>
            <button
              type="button"
              onClick={() => copy(issued()!.token)}
              {...stylex.props(s.btnGhost)}
            >
              <CopyIcon size={13} /> Copy
            </button>
          </div>
          <span {...stylex.props(styles.hint)}>
            {issued()!.token.startsWith('CORE_API_URL')
              ? 'Set these in the generated mcp/wrangler.jsonc and deploy. The instance id is the server’s credential — it is not shown again.'
              : 'Copy it into the agent’s MCP config now. Only a hash is stored, so a lost token must be reissued rather than recovered.'}
          </span>
        </div>
      </Show>

      <Show
        when={instances.data}
        fallback={<p {...stylex.props(s.muted)}>Loading MCP instances…</p>}
      >
        <div {...stylex.props(styles.tableWrap)}>
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th {...stylex.props(styles.th)}>Instance</th>
                <th {...stylex.props(styles.th)}>Scope</th>
                <th {...stylex.props(styles.th)}>Access</th>
                <th {...stylex.props(styles.th)}>Tool groups</th>
                {/*
                  Registered is not the same as deployed. The instance row exists from
                  the moment it is created, so "Enabled" alone cannot tell an operator
                  whether a worker is actually behind it — this column reports what the
                  deployment last said about itself.
                */}
                <th {...stylex.props(styles.th)}>Deployment</th>
                <th {...stylex.props(styles.th)}>Tokens</th>
                <th {...stylex.props(styles.th)} />
              </tr>
            </thead>
            <tbody>
              <For
                each={instances.data ?? []}
                fallback={
                  <tr>
                    <td {...stylex.props(styles.td)} colSpan={7}>
                      <div {...stylex.props(styles.empty)}>
                        No MCP instances in this scope yet. Create one to get the two
                        deployment values.
                      </div>
                    </td>
                  </tr>
                }
              >
                {(inst) => (
                  <tr>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.labelCell)}>
                        <span {...stylex.props(styles.labelMain)}>{inst.label}</span>
                        <span {...stylex.props(styles.labelSub)}>{inst.id}</span>
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.pill, styles.dimPill)}>
                        {inst.colony}
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.pillRow)}>
                        <span {...stylex.props(styles.pill, inst.enabled ? styles.okPill : styles.offPill)}>
                          {inst.enabled ? 'Enabled' : 'Disabled'}
                          {inst.enabled && <CheckIcon size={11} />}
                        </span>
                        <span {...stylex.props(styles.pill, inst.readonly ? styles.accentPill : styles.dimPill)}>
                          {inst.readonly ? 'Read-only' : 'Read/write'}
                        </span>
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.groupRow)}>
                        <For each={inst.toolGroups}>
                          {(g) => <span {...stylex.props(styles.groupChip)}>{g}</span>}
                        </For>
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.labelCell)}>
                        <span
                          {...stylex.props(
                            styles.pill,
                            presence(inst.lastSeenAt) === 'live'
                              ? styles.okPill
                              : presence(inst.lastSeenAt) === 'stale'
                                ? styles.offPill
                                : styles.dimPill,
                          )}
                        >
                          {PRESENCE_LABEL[presence(inst.lastSeenAt)]}
                          {presence(inst.lastSeenAt) === 'live' && <CheckIcon size={11} />}
                        </span>
                        <span {...stylex.props(styles.labelSub)}>
                          {/*
                            "no version" rather than a blank or a dash: the worker did
                            contact this core, it just predates the header that reports a
                            release. Conflating it with "never contacted" would hide the
                            upgrade it is a sign of.
                          */}
                          {inst.lastSeenAt
                            ? `v${inst.reportedVersion ?? 'unknown'} · ${ageLabel(inst.lastSeenAt)}`
                            : 'not deployed yet'}
                        </span>
                      </span>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null)
                          setTokenName('')
                          setTokenPerms([])
                          setExpiresIn('')
                          setManagingTokens(inst)
                        }}
                        {...stylex.props(s.btnGhost)}
                        title="Manage tokens"
                      >
                        <KeyIcon size={13} /> {inst.activeTokenCount}/{inst.tokenCount}
                      </button>
                    </td>
                    <td {...stylex.props(styles.td)}>
                      <Show when={canWrite()}>
                        <div {...stylex.props(styles.actions)}>
                          <button
                            type="button"
                            onClick={() => openEdit(inst)}
                            title={`Edit ${inst.label}`}
                            {...stylex.props(s.btnIcon, s.btnIconSm)}
                          >
                            <PencilIcon size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(inst)}
                            title={`Delete ${inst.label}`}
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

      <Show when={editing()}>
        <Sheet
          title={editing() === 'new' ? 'New MCP instance' : `Edit ${label()}`}
          onCloseRequest={() => true}
          onExited={() => setEditing(null)}
        >
          <form onSubmit={submit}>
            <div {...stylex.props(styles.form)}>
              <label {...stylex.props(s.label)}>
                Label
                <input
                  type="text"
                  value={label()}
                  onInput={(e) => setLabel(e.currentTarget.value)}
                  placeholder="Support agent"
                  spellcheck={false}
                  {...stylex.props(s.input)}
                />
              </label>

              <div>
                <p {...stylex.props(styles.sectionTitle)}>Access</p>
                <label {...stylex.props(s.label)}>
                  <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <input type="checkbox" checked={enabled()} onChange={(e) => setEnabled(e.currentTarget.checked)} />
                    Enabled
                  </span>
                </label>
                <label {...stylex.props(s.label)}>
                  <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <input type="checkbox" checked={readonly()} onChange={(e) => setReadonly(e.currentTarget.checked)} />
                    Read-only (the core refuses every write, not just the tool)
                  </span>
                </label>
              </div>

              <div {...stylex.props(styles.groupPicker)}>
                <p {...stylex.props(styles.sectionTitle)}>Tool groups</p>
                <For each={MCP_TOOL_GROUPS}>
                  {(g) => (
                    <label
                      {...stylex.props(
                        styles.groupOption,
                        groups().includes(g) && styles.groupOptionOn,
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={groups().includes(g)}
                        onChange={() => toggleGroup(g)}
                        style={{ 'margin-top': '2px' }}
                      />
                      <span {...stylex.props(styles.groupText)}>
                        <span {...stylex.props(styles.groupName)}>{groupLabel(g)}</span>
                        <span {...stylex.props(styles.groupBlast)}>
                          {blastRadius(g, readonly())}
                        </span>
                      </span>
                    </label>
                  )}
                </For>
                <span {...stylex.props(styles.hint)}>
                  A group’s blast radius is the permission set the core will actually
                  check. Effective now: {effectivePermissions().length} permission(s).
                </span>
              </div>

              <div>
                <p {...stylex.props(styles.sectionTitle)}>Per-collection tools</p>
                <label {...stylex.props(s.label)}>
                  Collections
                  <input
                    type="text"
                    value={dynamicTools()}
                    onInput={(e) => setDynamicTools(e.currentTarget.value)}
                    placeholder="all — or a comma-separated list"
                    spellcheck={false}
                    {...stylex.props(s.input)}
                  />
                </label>
                <label {...stylex.props(s.label)}>
                  Maximum
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={dynamicMax()}
                    onInput={(e) => setDynamicMax(Number(e.currentTarget.value) || 1)}
                    {...stylex.props(s.input)}
                  />
                </label>
              </div>

              <Show when={error()}>
                <p {...stylex.props(s.error)}>{error()}</p>
              </Show>

              <div {...stylex.props(styles.footer)}>
                <div {...stylex.props(styles.footerBtns)}>
                  <button type="submit" disabled={busy()} {...stylex.props(s.btn)}>
                    {busy() ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} {...stylex.props(s.btnGhost)}>
                    Cancel
                  </button>
                </div>
                <Show when={editing() !== 'new' && canWrite()}>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(editing() as McpInstance)}
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

      <Show when={managingTokens()}>
        <McpTokenSheet
          instance={managingTokens()!}
          target={target()}
          onClose={() => setManagingTokens(null)}
          onIssued={(name, token) => {
            setManagingTokens(null)
            setIssued({ name, token })
          }}
        />
      </Show>

      <Show when={pendingDelete()}>
        <Sheet title="Delete instance" onCloseRequest={() => true} onExited={() => setPendingDelete(null)}>
          <div {...stylex.props(styles.form)}>
            <p {...stylex.props(s.muted)}>
              Delete “{pendingDelete()!.label}” and its {pendingDelete()!.tokenCount} token(s)? Every
              agent using it stops working immediately, and the ids cannot be restored.
            </p>
            <Show when={error()}>
              <p {...stylex.props(s.error)}>{error()}</p>
            </Show>
            <div {...stylex.props(styles.footerBtns)}>
              <button
                type="button"
                disabled={busy()}
                onClick={() => remove(pendingDelete()!)}
                {...stylex.props(s.btnDanger)}
              >
                {busy() ? 'Deleting…' : 'Delete instance'}
              </button>
              <button type="button" onClick={() => setPendingDelete(null)} {...stylex.props(s.btnGhost)}>
                Cancel
              </button>
            </div>
          </div>
        </Sheet>
      </Show>
    </div>
  )
}

/**
 * Token management for one instance.
 *
 * Kept as its own component because it has its own query and its own sheet: the
 * instance list stays mounted underneath, and closing one panel never discards the
 * other's form state.
 */
function McpTokenSheet(props: {
  instance: McpInstance
  target: { land: string; colony: string }
  onClose: () => void
  onIssued: (name: string, token: string) => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [name, setName] = createSignal('')
  const [perms, setPerms] = createSignal<Permission[]>([])
  const [expiresIn, setExpiresIn] = createSignal('')

  /** Revoking is `mcp.write`; listing is `mcp.read`, so a read-only operator still sees the table. */
  const canWrite = () => hasPermission('mcp.write')

  const tokens = createQuery(() => ({
    queryKey: ['mcp-tokens', props.instance.id],
    queryFn: () => api.listMcpTokens(props.instance.id, props.target).then((r) => r.data),
  }))

  /**
   * What a token can be granted: the union of the instance's own permissions.
   *
   * A token may be strictly less powerful than its instance, never more, so the list
   * is derived rather than the full `PERMISSIONS` set. Offering a permission the
   * instance itself lacks would be a control that always silently does nothing.
   */
  const grantable = createMemo(() => props.instance.enabled
    ? mcpPermissions({ toolGroups: props.instance.toolGroups, readonly: props.instance.readonly })
    : [])

  const issue = async (e: Event) => {
    e.preventDefault()
    if (busy()) return
    if (name().trim() === '') {
      setError('Name the token so you can tell whose it is.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const input: McpTokenCreateInput = { name: name().trim() }
      if (perms().length > 0) input.permissions = perms()
      if (expiresIn().trim()) input.expiresAt = new Date(expiresIn()).toISOString()
      const res = await api.createMcpToken(props.instance.id, input, props.target)
      logActivity('mcp.token.create', 'Issued MCP token', `${props.instance.label} · ${input.name}`)
      await queryClient.invalidateQueries({ queryKey: ['mcp-tokens', props.instance.id] })
      await queryClient.invalidateQueries({ queryKey: ['mcp-instances'] })
      props.onIssued(input.name, res.data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue token')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (t: McpToken) => {
    if (!window.confirm(`Revoke "${t.name}"? Agents using it stop working within 15 minutes.`)) return
    setError(null)
    try {
      await api.revokeMcpToken(t.id, props.target)
      logActivity('mcp.token.revoke', 'Revoked MCP token', `${props.instance.label} · ${t.name}`)
      await queryClient.invalidateQueries({ queryKey: ['mcp-tokens', props.instance.id] })
      await queryClient.invalidateQueries({ queryKey: ['mcp-instances'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token')
    }
  }

  const togglePerm = (p: Permission) => {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const statusOf = (t: McpToken): { label: string; tone: 'ok' | 'dim' } => {
    if (t.revokedAt) return { label: 'Revoked', tone: 'dim' }
    if (t.expiresAt && new Date(t.expiresAt).getTime() <= Date.now()) {
      return { label: 'Expired', tone: 'dim' }
    }
    return { label: 'Active', tone: 'ok' }
  }

  return (
    <Sheet title={`Tokens · ${props.instance.label}`} onCloseRequest={() => true} onExited={props.onClose}>
      <div {...stylex.props(styles.sheetBody)}>
        <form onSubmit={issue}>
          <div {...stylex.props(styles.form)}>
            <label {...stylex.props(s.label)}>
              Name
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Laptop · Claude Desktop"
                spellcheck={false}
                {...stylex.props(s.input)}
              />
            </label>

            <div>
              <p {...stylex.props(styles.sectionTitle)}>Narrow the permissions (optional)</p>
              <div {...stylex.props(styles.perms)}>
                <Show
                  when={grantable().length > 0}
                  fallback={<span {...stylex.props(styles.hint)}>This instance authorizes nothing — enable it first.</span>}
                >
                  <For each={ALL_GROUP_PERMISSIONS}>
                    {(p) => (
                      <Show when={grantable().includes(p)}>
                        <label {...stylex.props(styles.permRow)}>
                          <input
                            type="checkbox"
                            checked={perms().includes(p)}
                            onChange={() => togglePerm(p)}
                          />
                          <span {...stylex.props(p.endsWith('.write') && styles.permWrite)}>{p}</span>
                        </label>
                      </Show>
                    )}
                  </For>
                </Show>
              </div>
              <span {...stylex.props(styles.hint)}>
                Leave everything unchecked to inherit the instance’s full access. Ticking
                anything narrows it for this caller only.
              </span>
            </div>

            <label {...stylex.props(s.label)}>
              Expires (optional)
              <input
                type="datetime-local"
                value={expiresIn()}
                onInput={(e) => setExpiresIn(e.currentTarget.value)}
                {...stylex.props(s.input)}
              />
            </label>

            <Show when={error()}>
              <p {...stylex.props(s.error)}>{error()}</p>
            </Show>

            <div {...stylex.props(styles.footerBtns)}>
              <button type="submit" disabled={busy()} {...stylex.props(s.btn)}>
                <ZapIcon size={13} /> {busy() ? 'Issuing…' : 'Issue token'}
              </button>
              <button type="button" onClick={props.onClose} {...stylex.props(s.btnGhost)}>
                Close
              </button>
            </div>
          </div>
        </form>

        <div>
          <p {...stylex.props(styles.sectionTitle)}>Issued tokens</p>
          <Show
            when={tokens.data}
            fallback={<p {...stylex.props(s.muted)}>Loading tokens…</p>}
          >
            <table {...stylex.props(styles.tokensTable)}>
              <thead>
                <tr>
                  <th {...stylex.props(styles.th)}>Name</th>
                  <th {...stylex.props(styles.th)}>Status</th>
                  <th {...stylex.props(styles.th)}>Last used</th>
                  <th {...stylex.props(styles.th)} />
                </tr>
              </thead>
              <tbody>
                <For
                  each={tokens.data ?? []}
                  fallback={
                    <tr>
                      <td {...stylex.props(styles.td)} colSpan={4}>
                        <div {...stylex.props(styles.empty)}>No tokens yet.</div>
                      </td>
                    </tr>
                  }
                >
                  {(t) => {
                    const st = statusOf(t)
                    return (
                      <tr>
                        <td {...stylex.props(styles.td)}>
                          <div {...stylex.props(styles.tokenName)}>{t.name}</div>
                          <Show when={t.permissions}>
                            <div {...stylex.props(styles.tokenPerms)}>
                              {t.permissions!.length} narrowed permission(s)
                            </div>
                          </Show>
                        </td>
                        <td {...stylex.props(styles.td)}>
                          <span {...stylex.props(styles.pill, st.tone === 'ok' ? styles.okPill : styles.dimPill)}>
                            {st.label}
                          </span>
                        </td>
                        <td {...stylex.props(styles.td)}>
                          {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '—'}
                        </td>
                        <td {...stylex.props(styles.td)}>
                          <Show when={canWrite() && !t.revokedAt}>
                            <div {...stylex.props(styles.actions)}>
                              <button
                                type="button"
                                onClick={() => revoke(t)}
                                title={`Revoke ${t.name}`}
                                {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
                              >
                                <XIcon size={13} />
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
          </Show>
        </div>
      </div>
    </Sheet>
  )
}
