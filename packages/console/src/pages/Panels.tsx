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
import { useBeforeLeave, useNavigate } from '@solidjs/router'
import type { BeforeLeaveEventArgs } from '@solidjs/router'
import * as stylex from '@stylexjs/stylex'
import type { PanelDefinition } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { CollectionIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PanelEditor } from '../components/PanelEditor'
import { Sheet, type SheetApi } from '../components/Sheet'
import { useCollections } from '../hooks/collections'
import { useDeletePanel, usePanels, useSavePanel } from '../hooks/panels'
import { hasPermission } from '../lib/session'

const styles = stylex.create({
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 },
  card: { backgroundColor: tokens.surface, boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`, borderRadius: tokens.radius, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)', ':hover': { boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadowCardHover}`, transform: 'translateY(-3px)' } },
  cardTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: tokens.text },
  cardIcon: { color: tokens.accent, display: 'inline-flex' },
  meta: { fontSize: 12, color: tokens.textDim },
  actions: { display: 'flex', gap: 4, marginTop: 4 },
  empty: { padding: 32, textAlign: 'center', color: tokens.textDim, backgroundColor: tokens.surface, boxShadow: `0 0 0 1px ${tokens.border}`, borderRadius: tokens.radius },
})

export function PanelsPage() {
  const panels = usePanels()
  const collections = useCollections()
  const save = useSavePanel()
  const remove = useDeletePanel()
  const navigate = useNavigate()
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [editing, setEditing] = createSignal<PanelDefinition | null>(null)
  const [dirty, setDirty] = createSignal(false)
  let sheet: SheetApi | undefined
  const canWrite = () => hasPermission('panels.write')
  const [confirmState, setConfirmState] = createSignal<
    { kind: 'leave'; event: BeforeLeaveEventArgs } | { kind: 'close'; resolve: (allow: boolean) => void } | null
  >(null)

  useBeforeLeave((event) => {
    if (!dirty()) return
    event.preventDefault()
    setConfirmState({ kind: 'leave', event })
  })

  const openNew = () => {
    if (!canWrite()) return
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = (definition: PanelDefinition) => {
    if (!canWrite()) return
    setEditing(definition)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditing(null)
    setDirty(false)
  }

  const requestClose = (): boolean | Promise<boolean | void> => {
    if (confirmState()) return false
    if (!dirty()) return true
    return new Promise<boolean>((resolve) => setConfirmState({ kind: 'close', resolve }))
  }

  const submit = async (definition: PanelDefinition) => {
    await save.mutateAsync({ id: editing()?.id, definition })
    closeEditor()
  }

  const deletePanel = async (id: string) => {
    if (!canWrite()) return
    if (!confirm(`Delete panel '${id}'?`)) return
    await remove.mutateAsync(id)
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(styles.header)}>
        <div>
          <h1 {...stylex.props(s.heading)}>Panels</h1>
          <p {...stylex.props(s.subheading)}>Build configurable data panels with views, menus, and role access.</p>
        </div>
        <button type="button" disabled={!canWrite || !collections.data?.length} onClick={openNew} title="New panel" aria-label="New panel" {...stylex.props(s.btnIcon)}><PlusIcon size={15} /></button>
      </div>

      <Show when={editorOpen()}>
        <Sheet
          title={editing() ? `Edit ${editing()!.name}` : 'New panel'}
          onCloseRequest={requestClose}
          onExited={closeEditor}
          onReady={(api) => {
            sheet = api
          }}
        >
          <PanelEditor
            initial={editing()}
            busy={save.isPending}
            onSubmit={submit}
            onCancel={() => sheet?.requestClose()}
            onDirtyChange={setDirty}
          />
        </Sheet>
      </Show>

      <Show when={confirmState()}>
        <ConfirmDialog
          title="Discard changes?"
          message="Unsaved changes to this panel manifest will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => {
            const current = confirmState()
            setConfirmState(null)
            if (current?.kind === 'leave') current.event.retry(true)
            else if (current?.kind === 'close') current.resolve(true)
          }}
          onCancel={() => {
            const current = confirmState()
            setConfirmState(null)
            if (current?.kind === 'close') current.resolve(false)
          }}
        />
      </Show>

      <Show when={save.error}><p {...stylex.props(s.error)}>{String(save.error?.message ?? 'Failed to save panel')}</p></Show>
      <Show when={remove.error}><p {...stylex.props(s.error)}>{String(remove.error?.message ?? 'Failed to delete panel')}</p></Show>
      <Show when={!collections.data?.length && !collections.isLoading}><p {...stylex.props(s.muted)}>Create a collection before creating a panel.</p></Show>

      <Show when={!panels.isLoading && panels.data} fallback={<p {...stylex.props(s.muted)}>Loading panels…</p>}>
        <Show when={panels.data!.length > 0} fallback={<div {...stylex.props(styles.empty)}>No panels yet. Create one to define a custom panel.</div>}>
          <div {...stylex.props(styles.list)}>
            <For each={panels.data}>
              {(panel) => <div
                {...stylex.props(styles.card)}
                onClick={() => navigate(`/panels/${panel.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/panels/${panel.id}`)
                  }
                }}
              >
                <div {...stylex.props(styles.cardTitle)}><span {...stylex.props(styles.cardIcon)}><CollectionIcon name={panel.icon} /></span>{panel.name}</div>
                <div {...stylex.props(styles.meta)}>{panel.id} · {panel.views.length} {panel.views.length === 1 ? 'view' : 'views'} · {panel.roles.length} {panel.roles.length === 1 ? 'role' : 'roles'}</div>
                {panel.description && <div {...stylex.props(styles.meta)}>{panel.description}</div>}
                <Show when={canWrite}>
                  <div {...stylex.props(styles.actions)}>
                    <button type="button" title="Edit panel" aria-label={`Edit ${panel.name}`} onClick={(e) => { e.stopPropagation(); openEdit(panel) }} {...stylex.props(s.btnIcon, s.btnIconSm)}><PencilIcon size={14} /></button>
                    <button type="button" title="Delete panel" aria-label={`Delete ${panel.name}`} onClick={(e) => { e.stopPropagation(); void deletePanel(panel.id) }} {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}><TrashIcon size={14} /></button>
                  </div>
                </Show>
              </div>}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}
