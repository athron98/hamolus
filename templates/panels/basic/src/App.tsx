import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js'
import type { JSX } from 'solid-js'
import { createPanelClient, normalizePanelError } from '@hamolus/panel'
import type {
  PanelBootstrap,
  PanelClient,
  PanelDashboardViewDefinition,
  PanelError,
  PanelFormViewDefinition,
  PanelMetricResult,
  PanelRecord,
  PanelRecordListResponse,
  PanelTableViewDefinition,
  PanelViewDefinition,
} from '@hamolus/panel'
import type { PanelConfig } from './panel'
import { missingTokenMessage } from './panel'
import {
  FONTS,
  PALETTES,
  applyFont,
  applyMode,
  applyPalette,
  font,
  isDark,
  mode,
  palette,
  toggleMode,
} from './theme'

type RuntimeState = {
  client: PanelClient
  bootstrap: PanelBootstrap
}

type NavItem = {
  id: string
  label: string
  viewId: string
}

type RuntimeViewProps = {
  client: PanelClient
  panelId: string
  view: PanelViewDefinition
  refreshToken: number
  locale?: string
}

type RecordsViewProps = {
  view: PanelTableViewDefinition | PanelFormViewDefinition
  records?: PanelRecordListResponse
  search: string
  page: number
  loading: boolean
  error?: PanelError
  onSearch: (value: string) => void
  onPage: (value: number) => void
  onRetry: () => void
}

export function App(props: { panel: PanelConfig }) {
  const [runtime, setRuntime] = createSignal<RuntimeState>()
  const [activeViewId, setActiveViewId] = createSignal<string>()
  const [refreshToken, setRefreshToken] = createSignal(0)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<PanelError>()
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  let disposed = false

  onCleanup(() => {
    disposed = true
  })

  onMount(() => {
    void (async () => {
      try {
        const client = createPanelClient({
          apiBase: props.panel.apiUrl,
          token: props.panel.token,
          land: props.panel.land,
          colony: props.panel.colony,
        })
        const bootstrap = await client.bootstrap(props.panel.id)
        if (disposed) return

        const views = bootstrap.panel.views
        const requestedView = props.panel.defaultView
        const selectedView = requestedView && views.some((view) => view.id === requestedView)
          ? requestedView
          : bootstrap.panel.menu[0]?.viewId ?? views[0]?.id
        if (!selectedView) throw new Error('This panel has no available views')

        setRuntime({ client, bootstrap })
        setActiveViewId(selectedView)
      } catch (cause) {
        if (!disposed) {
          const missing = missingTokenMessage()
          setError(
            missing
              ? ({ code: 'MISSING_TOKEN', message: missing } as PanelError)
              : normalizePanelError(cause, 'Unable to load this panel'),
          )
        }
      } finally {
        if (!disposed) setLoading(false)
      }
    })()
  })

  const navigation = createMemo<NavItem[]>(() => {
    const current = runtime()
    if (!current) return []
    if (current.bootstrap.panel.menu.length > 0) {
      return current.bootstrap.panel.menu.map((item) => ({
        id: item.id,
        label: item.label,
        viewId: item.viewId,
      }))
    }
    return current.bootstrap.panel.views.map((view) => ({
      id: `view-${view.id}`,
      label: view.label,
      viewId: view.id,
    }))
  })

  const activeView = createMemo(() => {
    const current = runtime()
    const viewId = activeViewId()
    return current?.bootstrap.panel.views.find((view) => view.id === viewId)
  })

  const refresh = () => setRefreshToken((value) => value + 1)
  const reload = () => window.location.reload()
  const closeSidebar = () => setSidebarOpen(false)

  const selectView = (viewId: string) => {
    setActiveViewId(viewId)
    closeSidebar()
  }

  // A view switch hides the drawer on small screens, matching the console.
  createEffect(() => {
    activeViewId()
    closeSidebar()
  })

  // Escape closes the drawer; the body scroll is locked while it is open.
  createEffect(() => {
    if (!sidebarOpen()) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebar()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    onCleanup(() => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    })
  })

  return (
    <div class="shell">
      <div class="glow" />

      <Show when={sidebarOpen()}>
        <button
          type="button"
          class="scrim"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      </Show>

      <aside class="sidebar" classList={{ sidebarHidden: !sidebarOpen() }}>
        <div class="sidebarBrand">
          <div class="brandMark">{initials(props.panel.name)}</div>
          <div class="brandText">
            <span class="brandName">{props.panel.name}</span>
            <Show when={runtime()}>
              {(current) => (
                <span class="brandSub">
                  {current().bootstrap.panel.description || 'Hamolus panel'}
                </span>
              )}
            </Show>
          </div>
          <button
            type="button"
            class="btnGhost drawerClose"
            aria-label="Close navigation"
            onClick={closeSidebar}
          >
            <CloseIcon />
          </button>
        </div>

        <Show when={navigation().length > 0}>
          <p class="sidebarSection">Views</p>
          <nav aria-label="Panel views">
            <For each={navigation()}>
              {(item) => (
                <button
                  type="button"
                  class="sideLink"
                  classList={{ sideLinkActive: activeViewId() === item.viewId }}
                  aria-current={activeViewId() === item.viewId ? 'page' : undefined}
                  onClick={() => selectView(item.viewId)}
                >
                  <span class="sideDot" />
                  <span class="sideLabel">{item.label}</span>
                </button>
              )}
            </For>
          </nav>
        </Show>

        <div class="sidebarFoot">
          <Show when={runtime()}>
            {(current) => (
              <div class="sideUser">
                <span class="sideUserName">
                  {current().bootstrap.user.name || current().bootstrap.user.username}
                </span>
                <span class="sideUserRole">{current().bootstrap.role.label}</span>
              </div>
            )}
          </Show>
        </div>
      </aside>

      <div class="content">
        <header class="topbar">
          <button
            type="button"
            class="navToggle"
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen()}
            onClick={() => setSidebarOpen((value) => !value)}
          >
            <MenuIcon />
          </button>

          <span class="topbarTitle">{activeView()?.label ?? props.panel.name}</span>

          <div class="spacer" />

          <Show when={runtime()}>
            <div class="topbarActions">
              <button type="button" class="btn" onClick={refresh}>
                Refresh
              </button>
              <AppearanceMenu />
            </div>
          </Show>
        </header>

        <main class="main">
          <Show when={!loading()} fallback={<p class="empty" role="status">Loading panel…</p>}>
            <Show when={!error()} fallback={<ErrorPanel error={error()!} onRetry={reload} />}>
              <Show when={activeView()} keyed fallback={<p class="empty">No views are available.</p>}>
                {(view) => {
                  const current = runtime()
                  return current ? (
                    <RuntimeView
                      client={current.client}
                      panelId={props.panel.id}
                      view={view}
                      refreshToken={refreshToken()}
                      locale={props.panel.locale}
                    />
                  ) : null
                }}
              </Show>
            </Show>
          </Show>
        </main>
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
  )
}

function AppearanceMenu() {
  const [open, setOpen] = createSignal(false)
  let wrap: HTMLDivElement | undefined

  createEffect(() => {
    if (!open()) return
    const onPointerDown = (event: MouseEvent) => {
      if (wrap && event.target instanceof Node && !wrap.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    })
  })

  return (
    <div class="popWrap" ref={wrap}>
      <button
        type="button"
        class="btnGhost"
        aria-expanded={open()}
        aria-haspopup="true"
        title="Appearance"
        onClick={() => setOpen((value) => !value)}
      >
        {isDark() ? 'Dark' : 'Light'}
      </button>

      <Show when={open()}>
        <div class="pop" role="menu" aria-label="Appearance">
          <div class="popSection">
            <p class="popLabel">Mode</p>
            <div class="seg">
              <For each={['dark', 'light'] as const}>
                {(value) => (
                  <button
                    type="button"
                    class="segBtn"
                    classList={{ segBtnActive: mode() === value }}
                    onClick={() => applyMode(value)}
                  >
                    {value === 'dark' ? 'Dark' : 'Light'}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="popSection">
            <p class="popLabel">Theme</p>
            <div class="swatches">
              <For each={PALETTES}>
                {(option) => (
                  <button
                    type="button"
                    class="swatch"
                    classList={{ swatchActive: palette() === option.id }}
                    style={{ 'background-color': option.hex }}
                    title={option.name}
                    aria-label={option.name}
                    aria-pressed={palette() === option.id}
                    onClick={() => applyPalette(option.id)}
                  />
                )}
              </For>
            </div>
          </div>

          <div class="popSection">
            <p class="popLabel">Font</p>
            <div class="fontRow">
              <For each={FONTS}>
                {(option) => (
                  <button
                    type="button"
                    class="fontBtn"
                    classList={{ fontBtnActive: font() === option.id }}
                    onClick={() => applyFont(option.id)}
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="popSection">
            <button type="button" class="btnGhost" style={{ width: '100%' }} onClick={toggleMode}>
              Switch to {isDark() ? 'light' : 'dark'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}

function RuntimeView(props: RuntimeViewProps) {
  const [search, setSearch] = createSignal('')
  const [page, setPage] = createSignal(1)
  const [records, setRecords] = createSignal<PanelRecordListResponse>()
  const [metrics, setMetrics] = createSignal<PanelMetricResult[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<PanelError>()
  const [retryToken, setRetryToken] = createSignal(0)
  let disposed = false
  let requestNumber = 0

  onCleanup(() => {
    disposed = true
  })

  createEffect(() => {
    const view = props.view
    const viewId = view.id
    const currentPage = page()
    const currentSearch = search().trim()
    props.refreshToken
    retryToken()
    const request = ++requestNumber
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    setLoading(true)
    setError(undefined)

    if (view.kind === 'dashboard') {
      setRecords(undefined)
      void props.client
        .getDashboardMetrics(props.panelId, viewId, { signal: controller.signal })
        .then((result) => {
          if (!disposed && request === requestNumber) setMetrics(result)
        })
        .catch((cause: unknown) => {
          if (!disposed && request === requestNumber) {
            setError(normalizePanelError(cause, `Unable to load ${view.label}`))
          }
        })
        .finally(() => {
          if (!disposed && request === requestNumber) setLoading(false)
        })
      return
    }

    setMetrics([])
    void props.client
      .listRecords(
        props.panelId,
        viewId,
        {
          page: currentPage,
          pageSize: view.pageSize,
          search: currentSearch || undefined,
          locale: props.locale,
        },
        { signal: controller.signal },
      )
      .then((result) => {
        if (!disposed && request === requestNumber) setRecords(result)
      })
      .catch((cause: unknown) => {
        if (!disposed && request === requestNumber) {
          setError(normalizePanelError(cause, `Unable to load ${view.label}`))
        }
      })
      .finally(() => {
        if (!disposed && request === requestNumber) setLoading(false)
      })
  })

  const retry = () => setRetryToken((value) => value + 1)

  return (
    <section aria-labelledby={`view-${props.view.id}`}>
      <div class="viewHead">
        <div>
          <h2 class="viewTitle" id={`view-${props.view.id}`}>
            {props.view.label}
          </h2>
          <Show when={props.view.description}>
            <p class="viewDesc">{props.view.description}</p>
          </Show>
        </div>
        <button type="button" class="btnGhost" onClick={retry} disabled={loading()}>
          Refresh view
        </button>
      </div>

      <Show when={!loading()} fallback={<p class="empty" role="status">Loading view…</p>}>
        <Show when={!error()} fallback={<ErrorPanel error={error()!} onRetry={retry} />}>
          <Show
            when={props.view.kind === 'dashboard'}
            fallback={(
              <RecordsView
                view={props.view as PanelTableViewDefinition | PanelFormViewDefinition}
                records={records()}
                search={search()}
                page={page()}
                loading={loading()}
                onSearch={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                onPage={setPage}
                onRetry={retry}
              />
            )}
          >
            <DashboardView view={props.view as PanelDashboardViewDefinition} metrics={metrics()} />
          </Show>
        </Show>
      </Show>
    </section>
  )
}

function DashboardView(props: { view: PanelDashboardViewDefinition; metrics: PanelMetricResult[] }) {
  return (
    <Show
      when={props.metrics.length > 0}
      fallback={<p class="empty" role="status">No metrics are available.</p>}
    >
      <div class="metrics">
        <For each={props.metrics}>
          {(metric) => (
            <article class="metric">
              <Show when={metric.group}>
                <span class="metricGroup">{metric.group}</span>
              </Show>
              <span class="metricLabel">{metric.label}</span>
              <strong class="metricValue">
                {metric.value === null ? '—' : metric.value.toLocaleString()}
              </strong>
            </article>
          )}
        </For>
      </div>
    </Show>
  )
}

function RecordsView(props: RecordsViewProps) {
  const rows = () => props.records?.data ?? []
  const columns = () => props.view.fields.read

  return (
    <div>
      <Show when={props.view.searchable}>
        <div class="toolbar">
          <label class="visuallyHidden" for="panel-search">
            Search
          </label>
          <input
            id="panel-search"
            class="input"
            type="search"
            value={props.search}
            placeholder="Search records"
            onInput={(event) => props.onSearch(event.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={rows().length > 0} fallback={<p class="empty" role="status">No records found.</p>}>
        <Show
          when={columns().length > 0}
          fallback={<p class="empty" role="status">This view has no readable fields.</p>}
        >
          <Show
            when={props.view.kind === 'table'}
            fallback={<RecordCards rows={rows()} fields={columns()} />}
          >
            <RecordTable rows={rows()} fields={columns()} />
          </Show>
          <Pagination records={props.records} page={props.page} onPage={props.onPage} />
        </Show>
      </Show>
    </div>
  )
}

function RecordTable(props: { rows: PanelRecord[]; fields: string[] }) {
  return (
    <div class="tableWrap">
      <table class="table">
        <thead>
          <tr>
            <For each={props.fields}>{(field) => <th scope="col">{fieldLabel(field)}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(record) => (
              <tr>
                <For each={props.fields}>
                  {(field) => <td>{renderValue(record[field])}</td>}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

function RecordCards(props: { rows: PanelRecord[]; fields: string[] }) {
  return (
    <div class="cards">
      <For each={props.rows}>
        {(record, index) => (
          <article class="recordCard">
            <h3 class="recordTitle">Record {index() + 1}</h3>
            <dl>
              <For each={props.fields}>
                {(field) => (
                  <>
                    <dt>{fieldLabel(field)}</dt>
                    <dd>{renderValue(record[field])}</dd>
                  </>
                )}
              </For>
            </dl>
          </article>
        )}
      </For>
    </div>
  )
}

function Pagination(props: {
  records?: PanelRecordListResponse
  page: number
  onPage: (value: number) => void
}) {
  const meta = () => props.records?.meta
  const totalPages = () => Math.max(1, meta()?.totalPages ?? 1)
  const first = () => (meta()?.total ? (props.page - 1) * (meta()?.pageSize ?? 20) + 1 : 0)
  const last = () => {
    const current = meta()
    if (!current?.total) return 0
    return Math.min(current.pageSize * props.page, current.total)
  }

  return (
    <nav class="pagination" aria-label="Record pages">
      <span class="mono">
        {first()}–{last()} of {meta()?.total ?? 0}
      </span>
      <button
        type="button"
        class="btnGhost"
        disabled={props.page <= 1}
        onClick={() => props.onPage(props.page - 1)}
      >
        Previous
      </button>
      <span class="mono">
        Page {props.page} of {totalPages()}
      </span>
      <button
        type="button"
        class="btnGhost"
        disabled={props.page >= totalPages()}
        onClick={() => props.onPage(props.page + 1)}
      >
        Next
      </button>
    </nav>
  )
}

function ErrorPanel(props: { error: PanelError; onRetry: () => void }) {
  return (
    <div class="alert" role="alert">
      <p class="alertTitle">{props.error.message}</p>
      <p class="alertCode">{props.error.code}</p>
      <div class="alertActions">
        <button type="button" class="btn" onClick={props.onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'P'
  )
}

function fieldLabel(field: string): string {
  return field
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function renderValue(value: unknown): JSX.Element {
  if (value === null || value === undefined) return <span class="dim">—</span>
  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span class="mono">{String(value)}</span>
  }
  if (typeof value === 'string') return <>{value}</>
  return <span class="dim">{formatValue(value)}</span>
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
