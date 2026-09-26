import { createEffect, createSignal, For, Index, Show } from 'solid-js'
import type { CollectionDefinition, PanelDefinition, PanelMetricDefinition, PanelViewDefinition } from '@hamolus/types'
import { PANEL_OPERATIONS, PANEL_VIEW_KINDS, panelDefinitionSchema } from '@hamolus/types'
import * as stylex from '@stylexjs/stylex'
import { JsonEditor } from './JsonEditor'
import { s, tokens } from '../theme.stylex'
import { useCollections } from '../hooks/collections'
import { PlusIcon, TrashIcon } from './Icons'

const styles = stylex.create({
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modeSeg: { display: 'inline-flex', gap: 4, backgroundColor: tokens.bg, borderRadius: tokens.radiusSm, padding: 3 },
  modeBtn: { padding: '4px 10px', fontSize: 12, fontWeight: 600, color: tokens.textDim, backgroundColor: 'transparent', borderStyle: 'none', borderRadius: tokens.radiusSm, cursor: 'pointer', transition: 'color 0.15s ease, background-color 0.15s ease', ':hover': { color: tokens.text }, ':focus-visible': { outline: 'none', boxShadow: `0 0 0 3px ${tokens.focusRing}` } },
  modeBtnActive: { color: tokens.text, backgroundColor: tokens.surfaceRaised },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: tokens.text, textTransform: 'uppercase', letterSpacing: '.08em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  gridThree: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  full: { gridColumn: '1 / -1' },
  card: { backgroundColor: tokens.surface, boxShadow: `0 0 0 1px ${tokens.border}`, borderRadius: tokens.radius, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: tokens.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  wrapRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  checkGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: 6 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: tokens.textDim, minWidth: 0 },
  checkInput: { accentColor: tokens.accent },
  hint: { fontSize: 12, color: tokens.textDim },
  actionRow: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 },
  jsonLabel: { display: 'flex', flexDirection: 'column', gap: 4 },
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function defaultPanel(collection?: CollectionDefinition): PanelDefinition {
  const fields = collection?.fields.map((field) => field.name) ?? []
  const writable = collection?.fields.filter((field) => field.name !== 'id' && !field.hidden).map((field) => field.name) ?? []
  const view: PanelViewDefinition = {
    id: 'records',
    kind: 'table',
    label: 'Records',
    path: '/records',
    collection: collection?.name ?? 'records',
    searchable: true,
    pageSize: 20,
    fields: { read: fields, write: writable },
    operations: ['read', 'create', 'update', 'delete'],
    filters: [],
    form: true,
  }
  const access = { viewId: view.id, operations: view.operations, readFields: fields, writeFields: writable }
  return {
    id: 'content_panel',
    name: 'Content panel',
    description: 'A configurable panel for structured content.',
    icon: 'grid',
    views: [view],
    menu: [{ id: 'records', label: 'Records', path: '/records', viewId: view.id }],
    roles: [{ id: 'admin', label: 'Administrator', description: 'Full access to this panel.', views: [access] }],
    members: [],
    defaultRoleId: 'admin',
  }
}

function textValue(value: string): string {
  return value
}

function viewCollection(view: PanelViewDefinition): string {
  return 'collection' in view ? view.collection : ''
}

function viewFields(view: PanelViewDefinition) {
  return view.fields
}

function viewSubmitLabel(view: PanelViewDefinition): string {
  return view.kind === 'form' ? view.submitLabel : 'Save'
}

function viewHasForm(view: PanelViewDefinition): boolean {
  return view.kind === 'table' ? view.form : true
}

function viewMetrics(view: PanelViewDefinition): PanelMetricDefinition[] {
  return view.kind === 'dashboard' ? view.metrics : []
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function makeView(kind: PanelViewDefinition['kind'], current: PanelViewDefinition, collection: string): PanelViewDefinition {
  const common = {
    id: current.id,
    label: current.label,
    path: current.path,
    icon: current.icon,
    description: current.description,
    searchable: current.searchable,
    pageSize: current.pageSize,
    fields: clone(current.fields),
    operations: clone(current.operations),
    filters: clone(current.filters),
    defaultSort: current.defaultSort ? clone(current.defaultSort) : undefined,
  }
  if (kind === 'dashboard') {
    return {
      ...common,
      kind,
      metrics: current.kind === 'dashboard' ? clone(current.metrics) : [{ id: 'total_records', label: 'Total records', collection, operation: 'count' }],
    }
  }
  if (kind === 'form') {
    return {
      ...common,
      kind,
      collection,
      submitLabel: current.kind === 'form' ? current.submitLabel : 'Save',
    }
  }
  return {
    ...common,
    kind,
    collection,
    form: current.kind === 'table' ? current.form : true,
  }
}

export function PanelEditor(props: {
  initial?: PanelDefinition | null
  busy?: boolean
  onSubmit: (definition: PanelDefinition) => void | Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const collections = useCollections()
  const [definition, setDefinition] = createSignal<PanelDefinition>(clone(props.initial ?? defaultPanel(collections.data?.[0])))
  const [mode, setMode] = createSignal<'form' | 'json'>('form')
  const [json, setJson] = createSignal(JSON.stringify(definition(), null, 2))
  const [error, setError] = createSignal('')
  const [dirty, setDirty] = createSignal(false)

  createEffect(() => {
    props.onDirtyChange?.(dirty())
  })

  const touch = () => {
    setDirty(true)
    setError('')
  }

  const update = (patch: Partial<PanelDefinition>) => {
    setDefinition((current) => ({ ...current, ...patch }))
    touch()
  }

  const updateView = (index: number, patch: Record<string, unknown>) => {
    setDefinition((current) => {
      const previousId = current.views[index]?.id
      const nextId = typeof patch.id === 'string' ? patch.id : previousId
      return {
        ...current,
        views: current.views.map((view, i) => (i === index ? ({ ...view, ...patch } as PanelViewDefinition) : view)),
        menu: previousId && nextId && previousId !== nextId
          ? current.menu.map((item) => (item.viewId === previousId ? { ...item, viewId: nextId } : item))
          : current.menu,
        roles: previousId && nextId && previousId !== nextId
          ? current.roles.map((role) => ({ ...role, views: role.views.map((access) => (access.viewId === previousId ? { ...access, viewId: nextId } : access)) }))
          : current.roles,
      }
    })
    touch()
  }

  const updateViewKind = (index: number, kind: PanelViewDefinition['kind'], collection: string) => {
    setDefinition((current) => ({
      ...current,
      views: current.views.map((view, i) => (i === index ? makeView(kind, view, collection) : view)),
    }))
    touch()
  }

  const updateViewFields = (index: number, kind: 'read' | 'write', field: string, enabled: boolean) => {
    setDefinition((current) => ({
      ...current,
      views: current.views.map((view, i) => {
        if (i !== index) return view
        const next = new Set(view.fields[kind])
        if (enabled) next.add(field)
        else next.delete(field)
        return { ...view, fields: { ...view.fields, [kind]: [...next] } } as PanelViewDefinition
      }),
    }))
    touch()
  }

  const updateViewOperation = (index: number, operation: (typeof PANEL_OPERATIONS)[number], enabled: boolean) => {
    setDefinition((current) => ({
      ...current,
      views: current.views.map((view, i) => {
        if (i !== index) return view
        const next = new Set(view.operations)
        if (enabled) next.add(operation)
        else next.delete(operation)
        return { ...view, operations: [...next] } as PanelViewDefinition
      }),
    }))
    touch()
  }

  const updateViewMetric = (viewIndex: number, metricIndex: number, patch: Record<string, unknown>) => {
    setDefinition((current) => ({
      ...current,
      views: current.views.map((view, i) => {
        if (i !== viewIndex || view.kind !== 'dashboard') return view
        return {
          ...view,
          metrics: view.metrics.map((metric, j) => (j === metricIndex ? ({ ...metric, ...patch } as typeof metric) : metric)),
        }
      }),
    }))
    touch()
  }

  const addView = () => {
    const current = definition()
    const collection = collections.data?.[0]?.name ?? ''
    const previous = current.views[current.views.length - 1]
    if (!previous) return
    let id = `view_${current.views.length + 1}`
    while (current.views.some((view) => view.id === id)) id = `view_${Number(id.slice(5)) + 1}`
    let path = `/${id.replace(/_/g, '-')}`
    let pathSuffix = current.menu.length + 1
    while (current.menu.some((item) => item.path === path)) {
      path = `/${id.replace(/_/g, '-')}-${pathSuffix}`
      pathSuffix += 1
    }
    const next = makeView('table', previous, collection)
    next.id = id
    next.label = 'New view'
    next.path = path
    setDefinition({
      ...current,
      views: [...current.views, next],
      menu: [
        ...current.menu,
        { id, label: 'New view', path: next.path, viewId: id },
      ],
    })
    touch()
  }

  const removeView = (index: number) => {
    setDefinition((current) => {
      const view = current.views[index]
      return {
        ...current,
        views: current.views.filter((_, i) => i !== index),
        menu: current.menu.filter((item) => item.viewId !== view?.id),
        roles: current.roles.map((role) => ({ ...role, views: role.views.filter((access) => access.viewId !== view?.id) })),
      }
    })
    touch()
  }

  const updateMenu = (index: number, patch: Record<string, unknown>) => {
    setDefinition((current) => ({ ...current, menu: current.menu.map((item, i) => (i === index ? { ...item, ...patch } : item)) }))
    touch()
  }

  const addMenu = () => {
    const current = definition()
    const view = current.views[0]
    if (!view) return
    let id = `menu_${current.menu.length + 1}`
    while (current.menu.some((item) => item.id === id)) id = `menu_${Number(id.slice(5)) + 1}`
    let path = `/${id.replace(/_/g, '-')}`
    let pathSuffix = current.menu.length + 1
    while (current.menu.some((item) => item.path === path)) {
      path = `/${id.replace(/_/g, '-')}-${pathSuffix}`
      pathSuffix += 1
    }
    setDefinition({ ...current, menu: [...current.menu, { id, label: 'New item', path, viewId: view.id }] })
    touch()
  }

  const removeMenu = (index: number) => {
    setDefinition((current) => ({ ...current, menu: current.menu.filter((_, i) => i !== index) }))
    touch()
  }

  const updateRole = (index: number, patch: Record<string, unknown>) => {
    setDefinition((current) => {
      const previousId = current.roles[index]?.id
      const nextId = typeof patch.id === 'string' ? patch.id : previousId
      return {
        ...current,
        roles: current.roles.map((role, i) => (i === index ? { ...role, ...patch } : role)),
        members: previousId && nextId && previousId !== nextId
          ? current.members.map((member) => (member.roleId === previousId ? { ...member, roleId: nextId } : member))
          : current.members,
        defaultRoleId: previousId && nextId && previousId !== nextId && current.defaultRoleId === previousId ? nextId : current.defaultRoleId,
      }
    })
    touch()
  }

  const addRole = () => {
    const current = definition()
    let id = `role_${current.roles.length + 1}`
    while (current.roles.some((role) => role.id === id)) id = `role_${Number(id.slice(5)) + 1}`
    setDefinition({ ...current, roles: [...current.roles, { id, label: 'New role', views: [] }] })
    touch()
  }

  const removeRole = (index: number) => {
    const current = definition()
    if (current.roles.length <= 1) return
    const roleId = current.roles[index]?.id
    if (!roleId) return
    const roles = current.roles.filter((_, i) => i !== index)
    setDefinition({
      ...current,
      roles,
      members: current.members.filter((member) => member.roleId !== roleId),
      defaultRoleId: current.defaultRoleId === roleId ? roles[0]?.id : current.defaultRoleId,
    })
    touch()
  }

  const updateRoleAccess = (roleIndex: number, accessIndex: number, patch: Record<string, unknown>) => {
    setDefinition((current) => ({
      ...current,
      roles: current.roles.map((role, i) => {
        if (i !== roleIndex) return role
        return { ...role, views: role.views.map((access, j) => (j === accessIndex ? { ...access, ...patch } : access)) }
      }),
    }))
    touch()
  }

  const addRoleAccess = (roleIndex: number) => {
    setDefinition((current) => ({
      ...current,
      roles: current.roles.map((role, i) => {
        if (i !== roleIndex || current.views.length === 0) return role
        const view = current.views.find((item) => !role.views.some((access) => access.viewId === item.id)) ?? current.views[0]
        return { ...role, views: [...role.views, { viewId: view.id, operations: ['read'], readFields: [], writeFields: [] }] }
      }),
    }))
    touch()
  }

  const removeRoleAccess = (roleIndex: number, accessIndex: number) => {
    setDefinition((current) => ({
      ...current,
      roles: current.roles.map((role, i) => (i === roleIndex ? { ...role, views: role.views.filter((_, j) => j !== accessIndex) } : role)),
    }))
    touch()
  }

  const updateMember = (index: number, patch: Record<string, unknown>) => {
    setDefinition((current) => ({ ...current, members: current.members.map((member, i) => (i === index ? { ...member, ...patch } : member)) }))
    touch()
  }

  const addMember = () => {
    const current = definition()
    const roleId = current.roles[0]?.id ?? 'admin'
    setDefinition({ ...current, members: [...current.members, { userId: '', roleId, attributes: {} }] })
    touch()
  }

  const removeMember = (index: number) => {
    setDefinition((current) => ({ ...current, members: current.members.filter((_, i) => i !== index) }))
    touch()
  }

  const switchToJson = () => {
    setJson(JSON.stringify(definition(), null, 2))
    setMode('json')
  }

  const switchToForm = () => {
    try {
      const parsed = JSON.parse(json()) as PanelDefinition
      setDefinition(parsed)
      setError('')
      setMode('form')
      touch()
    } catch {
      setError('The manifest is not valid JSON.')
    }
  }

  const submit = () => {
    let candidate = definition()
    if (mode() === 'json') {
      try {
        candidate = JSON.parse(json()) as PanelDefinition
      } catch {
        setError('The manifest is not valid JSON.')
        return
      }
    }
    const result = panelDefinitionSchema.safeParse(candidate)
    if (!result.success) {
      setError(result.error.issues.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`).join('; '))
      return
    }
    setError('')
    void props.onSubmit(result.data)
  }

  const collectionFor = (name: string) => collections.data?.find((collection) => collection.name === name)

  return (
    <form
      class="panel-editor"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onChange={() => touch()}
    >
      <div {...stylex.props(styles.form)}>
        <div {...stylex.props(styles.header)}>
          <div>
            <h1 {...stylex.props(s.heading)}>{props.initial ? 'Edit panel' : 'New panel'}</h1>
            <p {...stylex.props(s.subheading)}>Define the panel views, menu, roles, and member access.</p>
          </div>
          <div {...stylex.props(styles.modeSeg)} role="tablist" aria-label="Panel editing mode">
            <button type="button" role="tab" aria-selected={mode() === 'form'} onClick={mode() === 'json' ? switchToForm : undefined} {...stylex.props(styles.modeBtn, mode() === 'form' && styles.modeBtnActive)}>Form</button>
            <button type="button" role="tab" aria-selected={mode() === 'json'} onClick={mode() === 'form' ? switchToJson : undefined} {...stylex.props(styles.modeBtn, mode() === 'json' && styles.modeBtnActive)}>JSON</button>
          </div>
        </div>

        <Show when={mode() === 'form'} fallback={<JsonEditor value={() => json()} onChange={(value) => { setJson(value); touch() }} ariaLabel="Panel manifest JSON" />}>
          <div {...stylex.props(styles.form)}>
            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.sectionTitle)}>Panel details</div>
              <div {...stylex.props(styles.grid)}>
                <div><label {...stylex.props(s.label)}>ID</label><input {...stylex.props(s.input)} value={textValue(definition().id)} onInput={(event) => update({ id: event.currentTarget.value })} /></div>
                <div><label {...stylex.props(s.label)}>Name</label><input {...stylex.props(s.input)} value={definition().name} onInput={(event) => update({ name: event.currentTarget.value })} /></div>
                <div {...stylex.props(styles.full)}><label {...stylex.props(s.label)}>Description</label><input {...stylex.props(s.input)} value={definition().description ?? ''} onInput={(event) => update({ description: event.currentTarget.value || undefined })} /></div>
                <div><label {...stylex.props(s.label)}>Icon</label><input {...stylex.props(s.input)} value={definition().icon ?? ''} placeholder="grid" onInput={(event) => update({ icon: event.currentTarget.value || undefined })} /></div>
                <div><label {...stylex.props(s.label)}>Default role</label><select {...stylex.props(s.select)} value={definition().defaultRoleId ?? ''} onChange={(event) => update({ defaultRoleId: event.currentTarget.value || undefined })}><option value="">None</option><For each={definition().roles}>{(role) => <option value={role.id} selected={definition().defaultRoleId === role.id}>{role.label}</option>}</For></select></div>
              </div>
              <div {...stylex.props(styles.gridThree)}>
                <div><label {...stylex.props(s.label)}>Theme mode</label><select {...stylex.props(s.select)} value={definition().theme?.mode ?? ''} onChange={(event) => update({ theme: { ...definition().theme, mode: (event.currentTarget.value || undefined) as 'dark' | 'light' | undefined } })}><option value="">System</option><option value="dark" selected={definition().theme?.mode === 'dark'}>Dark</option><option value="light" selected={definition().theme?.mode === 'light'}>Light</option></select></div>
                <div><label {...stylex.props(s.label)}>Palette</label><input {...stylex.props(s.input)} value={definition().theme?.palette ?? ''} onInput={(event) => update({ theme: { ...definition().theme, palette: event.currentTarget.value || undefined } })} /></div>
                <div><label {...stylex.props(s.label)}>Font</label><input {...stylex.props(s.input)} value={definition().theme?.font ?? ''} onInput={(event) => update({ theme: { ...definition().theme, font: event.currentTarget.value || undefined } })} /></div>
              </div>
            </div>

            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.header)}><div {...stylex.props(styles.sectionTitle)}>Views</div><button type="button" onClick={addView} {...stylex.props(s.btn, s.btnGhost)}><PlusIcon size={14} />Add view</button></div>
              <Index each={definition().views}>
                {(view, index) => {
                  const collectionName = viewCollection(view())
                  const collection = collectionFor(collectionName)
                  return <div {...stylex.props(styles.card)}>
                    <div {...stylex.props(styles.cardHeader)}><div {...stylex.props(styles.cardTitle)}>{view().label || 'Untitled view'}</div><button type="button" disabled={definition().views.length <= 1} onClick={() => removeView(index)} {...stylex.props(s.btnIcon, s.btnIconSm, s.btnIconDanger)}><TrashIcon size={14} /></button></div>
                    <div {...stylex.props(styles.grid)}>
                      <div><label {...stylex.props(s.label)}>View ID</label><input {...stylex.props(s.input)} value={view().id} onInput={(event) => updateView(index, { id: event.currentTarget.value })} /></div>
                      <div><label {...stylex.props(s.label)}>Label</label><input {...stylex.props(s.input)} value={view().label} onInput={(event) => updateView(index, { label: event.currentTarget.value })} /></div>
                      <div><label {...stylex.props(s.label)}>Kind</label><select {...stylex.props(s.select)} onChange={(event) => updateViewKind(index, event.currentTarget.value as PanelViewDefinition['kind'], collectionName)}><For each={PANEL_VIEW_KINDS}>{(kind) => <option value={kind} selected={view().kind === kind}>{kind}</option>}</For></select></div>
                      <div><label {...stylex.props(s.label)}>Path</label><input {...stylex.props(s.input)} value={view().path} onInput={(event) => updateView(index, { path: event.currentTarget.value })} /></div>
                      <Show when={view().kind !== 'dashboard'}><div><label {...stylex.props(s.label)}>Collection</label><select {...stylex.props(s.select)} onChange={(event) => updateViewKind(index, view().kind, event.currentTarget.value)}><For each={collections.data ?? []}>{(item) => <option value={item.name} selected={collectionName === item.name}>{item.label}</option>}</For></select></div></Show>
                      <div><label {...stylex.props(s.label)}>Icon</label><input {...stylex.props(s.input)} value={view().icon ?? ''} onInput={(event) => updateView(index, { icon: event.currentTarget.value || undefined })} /></div>
                    </div>
                    <div {...stylex.props(styles.wrapRow)}>
                      <label {...stylex.props(styles.check)}><input {...stylex.props(styles.checkInput)} type="checkbox" checked={view().searchable} onChange={(event) => updateView(index, { searchable: event.currentTarget.checked })} />Searchable</label>
                      <div><label {...stylex.props(s.label)}>Page size</label><input {...stylex.props(s.input)} type="number" min="1" max="100" value={view().pageSize} onInput={(event) => updateView(index, { pageSize: Number(event.currentTarget.value) })} /></div>
                    </div>
                    <Show when={view().kind === 'form'}><div><label {...stylex.props(s.label)}>Submit label</label><input {...stylex.props(s.input)} value={viewSubmitLabel(view())} onInput={(event) => updateView(index, { submitLabel: event.currentTarget.value })} /></div></Show>
                    <Show when={view().kind === 'table'}><label {...stylex.props(styles.check)}><input {...stylex.props(styles.checkInput)} type="checkbox" checked={viewHasForm(view())} onChange={(event) => updateView(index, { form: event.currentTarget.checked })} />Show create form</label></Show>
                    <div><label {...stylex.props(s.label)}>Operations</label><div {...stylex.props(styles.checkGrid)}><For each={PANEL_OPERATIONS}>{(operation) => <label {...stylex.props(styles.check)}><input {...stylex.props(styles.checkInput)} type="checkbox" checked={view().operations.includes(operation)} onChange={(event) => updateViewOperation(index, operation, event.currentTarget.checked)} />{operation}</label>}</For></div></div>
                    <Show when={collection}><div><label {...stylex.props(s.label)}>Readable fields</label><div {...stylex.props(styles.checkGrid)}><For each={collection!.fields}>{(field) => <label {...stylex.props(styles.check)}><input {...stylex.props(styles.checkInput)} type="checkbox" checked={viewFields(view()).read.includes(field.name)} onChange={(event) => updateViewFields(index, 'read', field.name, event.currentTarget.checked)} />{field.name}</label>}</For></div></div><div><label {...stylex.props(s.label)}>Writable fields</label><div {...stylex.props(styles.checkGrid)}><For each={collection!.fields}>{(field) => <label {...stylex.props(styles.check)}><input {...stylex.props(styles.checkInput)} type="checkbox" checked={viewFields(view()).write.includes(field.name)} onChange={(event) => updateViewFields(index, 'write', field.name, event.currentTarget.checked)} />{field.name}</label>}</For></div></div></Show>
                    <Show when={view().kind === 'dashboard'}><div><label {...stylex.props(s.label)}>Metrics</label><Index each={viewMetrics(view())}>{(metric, metricIndex) => <div {...stylex.props(styles.card)}><div {...stylex.props(styles.grid)}><div><label {...stylex.props(s.label)}>Metric ID</label><input {...stylex.props(s.input)} value={metric().id} onInput={(event) => updateViewMetric(index, metricIndex, { id: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>Label</label><input {...stylex.props(s.input)} value={metric().label} onInput={(event) => updateViewMetric(index, metricIndex, { label: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>Collection</label><select {...stylex.props(s.select)} onChange={(event) => updateViewMetric(index, metricIndex, { collection: event.currentTarget.value })}><For each={collections.data ?? []}>{(item) => <option value={item.name} selected={metric().collection === item.name}>{item.label}</option>}</For></select></div><div><label {...stylex.props(s.label)}>Operation</label><select {...stylex.props(s.select)} onChange={(event) => updateViewMetric(index, metricIndex, { operation: event.currentTarget.value })}><For each={['count', 'sum', 'avg', 'min', 'max'] as const}>{(operation) => <option value={operation} selected={metric().operation === operation}>{operation}</option>}</For></select></div><div><label {...stylex.props(s.label)}>Field</label><input {...stylex.props(s.input)} value={metric().field ?? ''} onInput={(event) => updateViewMetric(index, metricIndex, { field: event.currentTarget.value || undefined })} /></div></div><button type="button" onClick={() => { const current = definition(); setDefinition({ ...current, views: current.views.map((item, i) => i === index && item.kind === 'dashboard' ? { ...item, metrics: item.metrics.filter((_, j) => j !== metricIndex) } : item) }); touch() }} {...stylex.props(s.btn, s.btnDanger)}><TrashIcon size={14} />Remove metric</button></div>}</Index><button type="button" onClick={() => { const current = definition(); setDefinition({ ...current, views: current.views.map((item, i) => i === index && item.kind === 'dashboard' ? { ...item, metrics: [...item.metrics, { id: `metric_${item.metrics.length + 1}`, label: 'New metric', collection: collectionName || collections.data?.[0]?.name || 'records', operation: 'count' }] } : item) }); touch() }} {...stylex.props(s.btn, s.btnGhost)}><PlusIcon size={14} />Add metric</button></div></Show>
                  </div>
                }}
              </Index>
            </div>

            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.header)}><div {...stylex.props(styles.sectionTitle)}>Menu</div><button type="button" onClick={addMenu} {...stylex.props(s.btn, s.btnGhost)}><PlusIcon size={14} />Add item</button></div>
              <Index each={definition().menu}>{(item, index) => <div {...stylex.props(styles.card)}><div {...stylex.props(styles.grid)}><div><label {...stylex.props(s.label)}>ID</label><input {...stylex.props(s.input)} value={item().id} onInput={(event) => updateMenu(index, { id: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>Label</label><input {...stylex.props(s.input)} value={item().label} onInput={(event) => updateMenu(index, { label: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>Path</label><input {...stylex.props(s.input)} value={item().path} onInput={(event) => updateMenu(index, { path: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>View</label><select {...stylex.props(s.select)} onChange={(event) => updateMenu(index, { viewId: event.currentTarget.value })}><For each={definition().views}>{(view) => <option value={view.id} selected={item().viewId === view.id}>{view.label}</option>}</For></select></div><div><label {...stylex.props(s.label)}>Icon</label><input {...stylex.props(s.input)} value={item().icon ?? ''} onInput={(event) => updateMenu(index, { icon: event.currentTarget.value || undefined })} /></div><div {...stylex.props(styles.full)}><button type="button" onClick={() => removeMenu(index)} {...stylex.props(s.btn, s.btnDanger)}><TrashIcon size={14} />Remove item</button></div></div></div>}</Index>
              <Show when={definition().menu.length === 0}><p {...stylex.props(styles.hint)}>No menu items. Views are still available in the panel manifest.</p></Show>
            </div>

            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.header)}><div {...stylex.props(styles.sectionTitle)}>Roles</div><button type="button" onClick={addRole} {...stylex.props(s.btn, s.btnGhost)}><PlusIcon size={14} />Add role</button></div>
              <Index each={definition().roles}>{(role, index) => <div {...stylex.props(styles.card)}><div {...stylex.props(styles.grid)}><div><label {...stylex.props(s.label)}>Role ID</label><input {...stylex.props(s.input)} value={role().id} onInput={(event) => updateRole(index, { id: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>Label</label><input {...stylex.props(s.input)} value={role().label} onInput={(event) => updateRole(index, { label: event.currentTarget.value })} /></div><div {...stylex.props(styles.full)}><label {...stylex.props(s.label)}>Description</label><input {...stylex.props(s.input)} value={role().description ?? ''} onInput={(event) => updateRole(index, { description: event.currentTarget.value || undefined })} /></div></div><div><label {...stylex.props(s.label)}>View access</label><Index each={role().views}>{(access, accessIndex) => <div {...stylex.props(styles.card)}><div {...stylex.props(styles.grid)}><div><label {...stylex.props(s.label)}>View</label><select {...stylex.props(s.select)} onChange={(event) => updateRoleAccess(index, accessIndex, { viewId: event.currentTarget.value })}><For each={definition().views}>{(view) => <option value={view.id} selected={access().viewId === view.id}>{view.label}</option>}</For></select></div><div><label {...stylex.props(s.label)}>Read fields</label><input {...stylex.props(s.input)} value={(access().readFields ?? []).join(', ')} onInput={(event) => updateRoleAccess(index, accessIndex, { readFields: parseList(event.currentTarget.value) })} /></div><div><label {...stylex.props(s.label)}>Write fields</label><input {...stylex.props(s.input)} value={(access().writeFields ?? []).join(', ')} onInput={(event) => updateRoleAccess(index, accessIndex, { writeFields: parseList(event.currentTarget.value) })} /></div></div><div {...stylex.props(styles.checkGrid)}><For each={PANEL_OPERATIONS}>{(operation) => <label {...stylex.props(styles.check)}><input {...stylex.props(styles.checkInput)} type="checkbox" checked={access().operations.includes(operation)} onChange={(event) => updateRoleAccess(index, accessIndex, { operations: event.currentTarget.checked ? [...new Set([...access().operations, operation])] : access().operations.filter((item) => item !== operation) })} />{operation}</label>}</For></div><button type="button" onClick={() => removeRoleAccess(index, accessIndex)} {...stylex.props(s.btn, s.btnDanger)}><TrashIcon size={14} />Remove access</button></div>}</Index><button type="button" onClick={() => addRoleAccess(index)} {...stylex.props(s.btn, s.btnGhost)}><PlusIcon size={14} />Add access</button></div><button type="button" disabled={definition().roles.length <= 1} onClick={() => removeRole(index)} {...stylex.props(s.btn, s.btnDanger)}><TrashIcon size={14} />Remove role</button></div>}</Index>
            </div>

            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.header)}><div {...stylex.props(styles.sectionTitle)}>Members</div><button type="button" onClick={addMember} {...stylex.props(s.btn, s.btnGhost)}><PlusIcon size={14} />Add member</button></div>
              <Index each={definition().members}>{(member, index) => <div {...stylex.props(styles.card)}><div {...stylex.props(styles.grid)}><div><label {...stylex.props(s.label)}>User ID</label><input {...stylex.props(s.input)} value={member().userId} onInput={(event) => updateMember(index, { userId: event.currentTarget.value })} /></div><div><label {...stylex.props(s.label)}>Role</label><select {...stylex.props(s.select)} onChange={(event) => updateMember(index, { roleId: event.currentTarget.value })}><For each={definition().roles}>{(role) => <option value={role.id} selected={member().roleId === role.id}>{role.label}</option>}</For></select></div></div><button type="button" onClick={() => removeMember(index)} {...stylex.props(s.btn, s.btnDanger)}><TrashIcon size={14} />Remove member</button></div>}</Index>
              <Show when={definition().members.length === 0}><p {...stylex.props(styles.hint)}>No members assigned. Access can be granted later from the panel runtime.</p></Show>
            </div>
          </div>
        </Show>

        <Show when={error()}><p {...stylex.props(s.error)}>{error()}</p></Show>
        <div {...stylex.props(styles.actionRow)}><button type="button" onClick={props.onCancel} {...stylex.props(s.btn, s.btnGhost)}>Cancel</button><button type="submit" disabled={props.busy} {...stylex.props(s.btn)}>{props.busy ? 'Saving…' : 'Save panel'}</button></div>
      </div>
    </form>
  )
}
