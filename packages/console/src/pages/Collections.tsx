import { createSignal, For, Show } from 'solid-js'
import { useBeforeLeave, useNavigate } from '@solidjs/router'
import type { BeforeLeaveEventArgs } from '@solidjs/router'
import * as stylex from '@stylexjs/stylex'
import type { CollectionDefinition, GroupTreeNode } from '@hamolus/types'
import { buildGroupTree } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { CollectionEditor } from '../components/CollectionEditor'
import { Sheet, type SheetApi } from '../components/Sheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CollectionIcon, PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'
import {
  useCollections,
  useDeleteCollection,
  useSaveCollection,
} from '../hooks/collections'
import { useGroups } from '../hooks/groups'

const styles = stylex.create({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  card: {
    backgroundColor: tokens.surface,
    boxShadow: `0 0 0 1px ${tokens.border}, ${tokens.shadowCard}`,
    borderRadius: tokens.radius,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    textDecoration: 'none',
    color: tokens.text,
    cursor: 'pointer',
    transition:
      'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
    ':hover': {
      boxShadow: `0 0 0 1px ${tokens.borderStrong}, ${tokens.shadowCardHover}`,
      transform: 'translateY(-3px)',
    },
    ':focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 3px ${tokens.focusRing}`,
    },
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleIcon: {
    color: tokens.accent,
    flexShrink: 0,
    display: 'inline-flex',
  },
  cardMeta: {
    fontSize: 12,
    color: tokens.textDim,
  },
  cardActions: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  section: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14,
    alignContent: 'start',
  },
  sectionHeader: {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: tokens.textDim,
  },
  sectionCount: {
    fontSize: 10,
    fontFamily: tokens.fontMono,
    color: tokens.textDim,
  },
  nested: {
    marginTop: 12,
    paddingLeft: 14,
    borderLeft: `1px solid ${tokens.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
})

function countCollections(node: GroupTreeNode): number {
  return node.collections.length + node.children.reduce((a, c) => a + countCollections(c), 0)
}

type GroupSectionProps = {
  node: GroupTreeNode
  openEdit: (def: CollectionDefinition) => void
  deleteDef: (name: string) => void
}

function Card(props: { def: CollectionDefinition; openEdit: (def: CollectionDefinition) => void; deleteDef: (name: string) => void }) {
  const navigate = useNavigate()
  return (
    <div
      {...stylex.props(styles.card)}
      onClick={() => navigate(`/collections/${props.def.name}`)}
    >
      <div {...stylex.props(styles.cardTitle)}>
        <span {...stylex.props(styles.cardTitleIcon)}>
          <CollectionIcon name={props.def.icon} />
        </span>
        {props.def.label}
      </div>
      <div {...stylex.props(styles.cardMeta)}>
        {props.def.name} · {props.def.fields.length}{' '}
        {props.def.fields.length === 1 ? 'field' : 'fields'} ·{' '}
        {props.def.timestamps ? 'timestamps' : 'no timestamps'}
      </div>
      <div {...stylex.props(styles.cardActions)}>
        <button
          type="button"
          title="Edit collection"
          aria-label="Edit collection"
          {...stylex.props(s.btnIcon, s.btnIconSm)}
          onClick={(e) => {
            e.stopPropagation()
            props.openEdit(props.def)
          }}
        >
          <PencilIcon size={14} />
        </button>
        <button
          type="button"
          title="Delete collection"
          aria-label="Delete collection"
          {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}
          onClick={(e) => {
            e.stopPropagation()
            props.deleteDef(props.def.name)
          }}
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  )
}

function GroupSection(props: GroupSectionProps) {
  return (
    <Show when={props.node.collections.length + props.node.children.length > 0}>
      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.sectionHeader)}>
          <span>{props.node.label}</span>
          <span {...stylex.props(styles.sectionCount)}>{countCollections(props.node)}</span>
        </div>
        <For each={props.node.collections}>
          {(def) => <Card def={def} openEdit={props.openEdit} deleteDef={props.deleteDef} />}
        </For>
        <Show when={props.node.children.length > 0}>
          <div {...stylex.props(styles.nested)}>
            <For each={props.node.children}>
              {(child) => (
                <GroupSection node={child} openEdit={props.openEdit} deleteDef={props.deleteDef} />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}

export function CollectionsPage() {
  const collections = useCollections()
  const groupDefs = useGroups()
  const save = useSaveCollection()
  const remove = useDeleteCollection()
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [editing, setEditing] = createSignal<CollectionDefinition | null>(null)
  const [dirty, setDirty] = createSignal(false)
  let sheet: SheetApi | undefined
  const [confirmState, setConfirmState] = createSignal<
    { kind: 'leave'; event: BeforeLeaveEventArgs } | { kind: 'close'; resolve: (allow: boolean) => void } | null
  >(null)

  useBeforeLeave((e) => {
    if (!dirty()) return
    e.preventDefault()
    setConfirmState({ kind: 'leave', event: e })
  })

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const all = () => collections.data ?? []
  const ungrouped = () => all().filter((c) => !c.group)
  const tree = () => buildGroupTree(groupDefs.data ?? [], all())

  const openEdit = (def: CollectionDefinition) => {
    setEditing(def)
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
    return new Promise<boolean>((resolve) => {
      setConfirmState({ kind: 'close', resolve })
    })
  }

  const submit = async (def: CollectionDefinition) => {
    await save.mutateAsync(def)
    closeEditor()
  }

  const deleteDef = async (name: string) => {
    if (!confirm(`Delete collection '${name}' and all of its data?`)) return
    await remove.mutateAsync(name)
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(styles.header)}>
        <div>
          <h1 {...stylex.props(s.heading)}>Collections</h1>
          <p {...stylex.props(s.subheading)}>Manage the table schemas used by the API</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          title="New collection"
          aria-label="New collection"
          {...stylex.props(s.btnIcon)}
        >
          <PlusIcon size={15} />
        </button>
      </div>

      <Show when={editorOpen()}>
        <Sheet
          title={editing() ? `Edit ${editing()!.label}` : 'New collection'}
          onCloseRequest={requestClose}
          onExited={closeEditor}
          onReady={(api) => {
            sheet = api
          }}
        >
          <CollectionEditor
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
          message={
            confirmState()!.kind === 'leave'
              ? 'You are about to leave without saving. Unsaved changes to the collection definition will be lost.'
              : 'You have unsaved edits to this collection definition. Discard them and close the form?'
          }
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => {
            const c = confirmState()
            setConfirmState(null)
            if (c && c.kind === 'leave') c.event.retry(true)
            else if (c && c.kind === 'close') c.resolve(true)
          }}
          onCancel={() => {
            const c = confirmState()
            setConfirmState(null)
            if (c && c.kind === 'close') c.resolve(false)
          }}
        />
      </Show>

      <Show when={save.error}>
        <p {...stylex.props(s.error)}>{String(save.error?.message ?? 'Failed to save')}</p>
      </Show>
      <Show when={remove.error}>
        <p {...stylex.props(s.error)}>{String(remove.error?.message ?? 'Failed to delete')}</p>
      </Show>

      <Show
        when={!collections.isLoading && collections.data}
        fallback={<p {...stylex.props(s.muted)}>Loading collections…</p>}
      >
        <div {...stylex.props(styles.list)}>
          <For each={tree()}>
            {(node) => <GroupSection node={node} openEdit={openEdit} deleteDef={deleteDef} />}
          </For>
          <Show when={ungrouped().length > 0}>
            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.sectionHeader)}>
                <span>Other</span>
                <span {...stylex.props(styles.sectionCount)}>{ungrouped().length}</span>
              </div>
              <For each={ungrouped()}>
                {(def) => <Card def={def} openEdit={openEdit} deleteDef={deleteDef} />}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}