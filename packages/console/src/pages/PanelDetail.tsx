/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createMemo, createSignal, Show } from 'solid-js'
import { A, useBeforeLeave, useNavigate, useParams } from '@solidjs/router'
import type { BeforeLeaveEventArgs } from '@solidjs/router'
import * as stylex from '@stylexjs/stylex'
import type { PanelDefinition } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { CollectionIcon, PencilIcon, PinIcon, TrashIcon } from '../components/Icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PanelDefinitionView } from '../components/PanelDefinition'
import { PanelEditor } from '../components/PanelEditor'
import { Sheet, type SheetApi } from '../components/Sheet'
import { useDeletePanel, usePanels, useSavePanel } from '../hooks/panels'
import { pinned, togglePin } from '../lib/prefs'
import { hasPermission } from '../lib/session'

const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  headingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    color: tokens.accent,
    display: 'inline-flex',
  },
  actions: {
    display: 'flex',
    gap: 4,
  },
  pinActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: tokens.textDim,
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}`,
    borderRadius: tokens.radius,
  },
  backLink: {
    color: tokens.accent,
    fontSize: 13,
    fontWeight: 600,
  },
})

export function PanelDetailPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const panels = usePanels()
  const save = useSavePanel()
  const remove = useDeletePanel()

  const panel = createMemo<PanelDefinition | undefined>(() =>
    panels.data?.find((p) => p.id === params.id),
  )

  const [editorOpen, setEditorOpen] = createSignal(false)
  const [dirty, setDirty] = createSignal(false)
  let sheet: SheetApi | undefined
  const [confirmState, setConfirmState] = createSignal<
    { kind: 'leave'; event: BeforeLeaveEventArgs } | { kind: 'close'; resolve: (allow: boolean) => void } | null
  >(null)

  const canWrite = () => hasPermission('panels.write')

  useBeforeLeave((event) => {
    if (!dirty()) return
    event.preventDefault()
    setConfirmState({ kind: 'leave', event })
  })

  const openEdit = () => {
    if (!canWrite() || !panel()) return
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setDirty(false)
  }

  const requestClose = (): boolean | Promise<boolean | void> => {
    if (confirmState()) return false
    if (!dirty()) return true
    return new Promise<boolean>((resolve) => setConfirmState({ kind: 'close', resolve }))
  }

  const submit = async (definition: PanelDefinition) => {
    await save.mutateAsync({ id: definition.id, definition })
    closeEditor()
  }

  const deletePanel = async (id: string) => {
    if (!canWrite()) return
    if (!confirm(`Delete panel '${id}'?`)) return
    await remove.mutateAsync(id)
    navigate('/panels', { replace: true })
  }

  const viewCount = () => panel()?.views.length ?? 0

  return (
    <div {...stylex.props(s.page)}>
      <Show
        when={!panels.isLoading}
        fallback={<p {...stylex.props(s.muted)}>Loading panel…</p>}
      >
        <Show
          when={panel()}
          fallback={
            <div {...stylex.props(styles.empty)}>
              <p {...stylex.props(s.muted)}>Panel “{params.id}” was not found.</p>
              <A href="/panels" {...stylex.props(styles.backLink)}>
                Back to panels
              </A>
            </div>
          }
        >
          {(def) => (
            <>
              <div {...stylex.props(styles.header)}>
                <div>
                  <div {...stylex.props(styles.headingRow)}>
                    <span {...stylex.props(styles.icon)}>
                      <CollectionIcon name={def().icon} size={18} />
                    </span>
                    <h1 {...stylex.props(s.heading)}>{def().name}</h1>
                  </div>
                  <p {...stylex.props(s.subheading)}>
                    {def().id} · {viewCount()} {viewCount() === 1 ? 'view' : 'views'} ·{' '}
                    {def().roles.length} {def().roles.length === 1 ? 'role' : 'roles'} ·{' '}
                    {def().members.length} {def().members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
                <div {...stylex.props(styles.actions)}>
                  <button
                    type="button"
                    onClick={() => togglePin(def().id)}
                    title={
                      pinned().includes(def().id)
                        ? `Unpin ${def().name} from the navbar`
                        : `Pin ${def().name} to the navbar`
                    }
                    aria-label={`Pin ${def().name}`}
                    aria-pressed={pinned().includes(def().id)}
                    {...stylex.props(
                      s.btnIcon,
                      pinned().includes(def().id) && styles.pinActive,
                    )}
                  >
                    <PinIcon size={14} />
                  </button>
                  <Show when={canWrite()}>
                    <button
                      type="button"
                      onClick={openEdit}
                      title="Edit panel"
                      aria-label={`Edit ${def().name}`}
                      {...stylex.props(s.btnIcon)}
                    >
                      <PencilIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePanel(def().id)}
                      title="Delete panel"
                      aria-label={`Delete ${def().name}`}
                      {...stylex.props(s.btnIcon, s.btnIconDanger)}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </Show>
                </div>
              </div>

              <PanelDefinitionView panel={def()} />
            </>
          )}
        </Show>
      </Show>

      <Show when={editorOpen() && panel()}>
        <Sheet
          title={`Edit ${panel()!.name}`}
          onCloseRequest={requestClose}
          onExited={closeEditor}
          onReady={(api) => {
            sheet = api
          }}
        >
          <PanelEditor
            initial={panel()!}
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

      <Show when={save.error}>
        <p {...stylex.props(s.error)}>
          {String(save.error?.message ?? 'Failed to save panel')}
        </p>
      </Show>
      <Show when={remove.error}>
        <p {...stylex.props(s.error)}>
          {String(remove.error?.message ?? 'Failed to delete panel')}
        </p>
      </Show>
    </div>
  )
}
