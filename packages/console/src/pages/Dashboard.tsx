/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createQuery } from '@tanstack/solid-query'
import { createSignal, For, onMount, Show } from 'solid-js'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { Collapsible } from '../components/Collapsible'
import {
  CollectionIcon,
  DatabaseIcon,
  FolderIcon,
  GridIcon,
  ImageIcon,
  TrashIcon,
} from '../components/Icons'
import { api } from '../lib/api'
import {
  clearActivity,
  getActivity,
  onActivityChange,
  type ActivityEntry,
  type ActivityType,
} from '../lib/activity'

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  'collection.create': 'Created collection',
  'collection.update': 'Updated collection',
  'collection.delete': 'Deleted collection',
  'record.create': 'Created record',
  'record.update': 'Updated record',
  'record.delete': 'Deleted record',
  'media.upload': 'Uploaded media',
  'media.update': 'Updated media',
  'media.delete': 'Deleted media',
  'document.upload': 'Uploaded document',
  'document.update': 'Updated document',
  'document.delete': 'Deleted document',
  'attachment.upload': 'Uploaded attachment',
  'attachment.update': 'Updated attachment',
  'attachment.delete': 'Deleted attachment',
  'settings.update': 'Updated settings',
  'user.create': 'Created user',
  'user.update': 'Updated user',
  'user.delete': 'Deleted user',
  'config.create': 'Created config',
  'config.update': 'Updated config',
  'config.delete': 'Deleted config',
  'group.create': 'Created group',
  'group.update': 'Updated group',
  'group.delete': 'Deleted group',
  'land.create': 'Created land',
  'land.update': 'Updated land',
  'land.delete': 'Deleted land',
  'colony.create': 'Created colony',
  'colony.update': 'Updated colony',
  'colony.delete': 'Deleted colony',
  'super.create': 'Created super admin',
  'super.update': 'Updated super admin',
  'super.delete': 'Deleted super admin',
  'seed.export': 'Exported seed snapshot',
  'seed.apply': 'Applied seed snapshot',
  'panel.create': 'Created panel',
  'panel.update': 'Updated panel',
  'panel.delete': 'Deleted panel',
  'mcp.instance.create': 'Created MCP instance',
  'mcp.instance.update': 'Updated MCP instance',
  'mcp.instance.delete': 'Deleted MCP instance',
  'mcp.token.create': 'Issued MCP token',
  'mcp.token.revoke': 'Revoked MCP token',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

const styles = stylex.create({
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  statCard: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    transition:
      'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
    ':hover': {
      boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadowCardHover}`,
      transform: 'translateY(-3px)',
    },
  },
  statIcon: {
    color: tokens.accent,
    display: 'inline-flex',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontFamily: tokens.fontMono,
  },
  statLabel: {
    fontSize: 12,
    color: tokens.textDim,
  },
  colList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  colRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: tokens.radiusSm,
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  colInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  colName: {
    fontSize: 13,
    fontWeight: 600,
    color: tokens.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  colMeta: {
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
  },
  colCount: {
    fontSize: 12,
    fontFamily: tokens.fontMono,
    color: tokens.text,
    flexShrink: 0,
  },
  colGroup: {
    fontSize: 11,
    color: tokens.textDim,
    padding: '2px 8px',
    borderRadius: tokens.radiusSm,
    boxShadow: `0 0 0 1px ${tokens.borderStrong}`,
    whiteSpace: 'nowrap',
  },
  colBarWrap: {
    position: 'relative',
    height: 20,
    marginTop: -6,
    marginBottom: 6,
    marginLeft: 12,
    marginRight: 12,
  },
  colBarTrack: {
    position: 'absolute',
    inset: '0 0 0 0',
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.surfaceRaised,
    overflow: 'hidden',
  },
  colBarFill: {
    height: '100%',
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.accentBold,
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  historyToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  historyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: tokens.radiusSm,
    transition: 'background-color 0.15s ease',
    ':hover': { backgroundColor: tokens.surfaceRaised },
  },
  historyTag: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    padding: '2px 8px',
    borderRadius: tokens.radiusSm,
    fontFamily: tokens.fontMono,
  },
  tagCreate: {
    color: tokens.ok,
    backgroundColor: tokens.okSoft,
  },
  tagDelete: {
    color: tokens.danger,
    backgroundColor: tokens.dangerSoft,
  },
  tagUpdate: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  historyLabel: {
    fontSize: 13,
    color: tokens.text,
    minWidth: 0,
  },
  historyDetail: {
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  historyTime: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontSize: 11,
    color: tokens.textDim,
    fontFamily: tokens.fontMono,
  },
  empty: {
    padding: 16,
    color: tokens.textDim,
    fontSize: 13,
  },
})

function tagStyle(type: ActivityType) {
  if (type.endsWith('.create')) return styles.tagCreate
  if (type.endsWith('.delete')) return styles.tagDelete
  return styles.tagUpdate
}

function shortType(type: ActivityType): string {
  return type.split('.')[1] ?? type
}

export function DashboardPage() {
  const stats = createQuery(() => ({
    queryKey: ['stats'],
    queryFn: () => api.getStats().then((r) => r.data),
  }))
  const groupDefs = createQuery(() => ({
    queryKey: ['groups'],
    queryFn: () => api.listGroups().then((r) => r.data),
  }))

  const [entries, setEntries] = createSignal<ActivityEntry[]>(getActivity())
  onMount(() => onActivityChange(() => setEntries(getActivity())))

  const collections = () =>
    [...(stats.data?.perCollection ?? [])].sort((a, b) => b.count - a.count)
  const maxCount = () => Math.max(1, ...collections().map((c) => c.count))
  const groupLabel = (id: string | null | undefined) =>
    groupDefs.data?.find((g) => g.id === id)?.label ?? id ?? null

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(styles.statGrid)}>
        <Show when={stats.data} fallback={<p {...stylex.props(s.muted)}>Loading stats…</p>}>
          <div {...stylex.props(styles.statCard)}>
            <span {...stylex.props(styles.statIcon)}>
              <GridIcon size={18} />
            </span>
            <span {...stylex.props(styles.statValue)}>{stats.data!.collections}</span>
            <span {...stylex.props(styles.statLabel)}>Collections</span>
          </div>
          <div {...stylex.props(styles.statCard)}>
            <span {...stylex.props(styles.statIcon)}>
              <DatabaseIcon size={18} />
            </span>
            <span {...stylex.props(styles.statValue)}>{stats.data!.totalRecords}</span>
            <span {...stylex.props(styles.statLabel)}>Total records</span>
          </div>
          <div {...stylex.props(styles.statCard)}>
            <span {...stylex.props(styles.statIcon)}>
              <ImageIcon size={18} />
            </span>
            <span {...stylex.props(styles.statValue)}>{stats.data!.media}</span>
            <span {...stylex.props(styles.statLabel)}>Media assets</span>
          </div>
          <div {...stylex.props(styles.statCard)}>
            <span {...stylex.props(styles.statIcon)}>
              <FolderIcon size={18} />
            </span>
            <span {...stylex.props(styles.statValue)}>{stats.data!.groups}</span>
            <span {...stylex.props(styles.statLabel)}>Groups</span>
          </div>
        </Show>
      </div>

      <Collapsible
        id="dashboard:collections"
        title="Collections"
        meta={`${stats.data?.totalRecords ?? 0} records across ${stats.data?.collections ?? 0}`}
      >
        <Show
          when={collections().length > 0}
          fallback={<p {...stylex.props(styles.empty)}>No collections registered yet.</p>}
        >
            <div {...stylex.props(styles.colList)}>
              <For each={collections()}>
                {(c) => (
                  <div>
                    <div {...stylex.props(styles.colRow)}>
                      <span {...stylex.props(styles.colInfo)}>
                        <CollectionIcon name={c.icon} />
                        <span {...stylex.props(styles.colName)}>{c.label}</span>
                        <span {...stylex.props(styles.colMeta)}>{c.name}</span>
                      </span>
                      <Show when={c.group}>
                        <span {...stylex.props(styles.colGroup)}>{groupLabel(c.group)}</span>
                      </Show>
                      <span {...stylex.props(styles.colCount)}>{c.count}</span>
                    </div>
                    <div {...stylex.props(styles.colBarWrap)}>
                      <div {...stylex.props(styles.colBarTrack)}>
                        <div
                          {...stylex.props(styles.colBarFill)}
                          style={{ width: `${(c.count / maxCount()) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
      </Collapsible>

      <Collapsible
        id="dashboard:history"
        title="Action history"
        meta={`${entries().length} actions`}
      >
        <div {...stylex.props(styles.historyToolbar)}>
          <span {...stylex.props(s.muted)}>
            Actions you take in the console, tracked on this device.
          </span>
          <Show when={entries().length > 0}>
            <button
              type="button"
              onClick={() => clearActivity()}
              title="Clear action history"
              aria-label="Clear action history"
              {...stylex.props(s.btnIcon, s.btnIconSm)}
            >
              <TrashIcon size={14} />
            </button>
          </Show>
        </div>
        <Show
          when={entries().length > 0}
          fallback={
            <p {...stylex.props(styles.empty)}>
              No activity yet — create, update or delete something and it will show up here.
            </p>
          }
        >
          <div {...stylex.props(styles.historyList)}>
            <For each={entries()}>
              {(e) => (
                <div {...stylex.props(styles.historyRow)}>
                  <span {...stylex.props(styles.historyTag, tagStyle(e.type))}>
                    {shortType(e.type)}
                  </span>
                  <span {...stylex.props(styles.historyLabel)}>{e.label}</span>
                  <Show when={e.detail}>
                    <span {...stylex.props(styles.historyDetail)}>{e.detail}</span>
                  </Show>
                  <span {...stylex.props(styles.historyTime)}>{timeAgo(e.at)}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Collapsible>
    </div>
  )
}