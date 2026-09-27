// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { PanelError, createPanelClient, normalizePanelError } from '@hamolus/panel'
import type {
  PanelBootstrap,
  PanelClient,
  PanelMetricResult,
  PanelRecordListResponse,
  PanelRuntimeConfig,
  PanelTableViewDefinition,
} from '@hamolus/panel'
import { missingTokenMessage } from './panel'

/**
 * An example dashboard panel.
 *
 * The flow is kept deliberately short so it is easy to copy:
 *
 *   1. `createPanelClient` — one object for every request, with the token and scope already
 *      attached.
 *   2. `getLocalization()` — a public endpoint; used only to pick the first locale.
 *   3. `bootstrap(panelId)` — the panel manifest: views, readable fields, and the allowed
 *      operations. The panel does not redefine any of these on the frontend.
 *   4. Rendering: `dashboard` -> `getDashboardMetrics`, anything else -> `listRecords`.
 *
 * A note on `getLocalization()`: it is raced against bootstrap, and its failure is
 * deliberately swallowed. This endpoint only picks the locale of the first request, so a
 * failure there is no reason to bring the whole panel down.
 */

type Runtime = {
  client: PanelClient
  bootstrap: PanelBootstrap
  tableViews: PanelTableViewDefinition[]
  dashboardViewIds: string[]
}

export function App(props: { panel: PanelRuntimeConfig }) {
  const [runtime, setRuntime] = createSignal<Runtime>()
  const [metrics, setMetrics] = createSignal<PanelMetricResult[]>([])
  const [records, setRecords] = createSignal<PanelRecordListResponse>()
  const [search, setSearch] = createSignal('')
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<PanelError>()
  let disposed = false
  let requestNumber = 0

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

        const [localization, bootstrap] = await Promise.all([
          client.getLocalization().catch(() => null),
          client.bootstrap(props.panel.id),
        ])
        if (disposed) return

        const views = bootstrap.panel.views
        const dashboardViewIds = views.filter((view) => view.kind === 'dashboard').map((view) => view.id)
        const tableViews = views.filter((view) => view.kind === 'table') as PanelTableViewDefinition[]

        setRuntime({
          client,
          bootstrap,
          tableViews,
          dashboardViewIds: dashboardViewIds.length > 0 ? dashboardViewIds : [views[0]?.id].filter(Boolean) as string[],
        })

        // Only a locale the core actually declares is used. If the env hands over an unknown
        // code, fall back to the core's defaultLocale.
        if (localization) {
          const declared = localization.locales.map((entry) => entry.code)
          const preselected = props.panel.locale
          if (preselected && declared.includes(preselected)) {
            sessionStorage.setItem('hamolus.locale', preselected)
          } else {
            sessionStorage.setItem('hamolus.locale', localization.defaultLocale)
          }
        }
      } catch (cause) {
        if (disposed) return
        const missing = missingTokenMessage(props.panel)
        setError(
          missing
            ? new PanelError(missing, { code: 'MISSING_TOKEN' })
            : normalizePanelError(cause, 'Could not load the SEO panel'),
        )
      } finally {
        if (!disposed) setLoading(false)
      }
    })()
  })

  // Dashboard metrics are fetched once per load, then refreshed through the button.
  createEffect(() => {
    const current = runtime()
    const viewIds = current?.dashboardViewIds
    if (!viewIds || viewIds.length === 0) return
    let cancelled = false
    void Promise.all(
      viewIds.map((viewId) =>
        current.client
          .getDashboardMetrics(props.panel.id, viewId)
          .catch(() => [] as PanelMetricResult[]),
      ),
    ).then((groups) => {
      if (!cancelled) setMetrics(groups.flat())
    })
    onCleanup(() => {
      cancelled = true
    })
  })

  // The record list follows the search box. Every change aborts the previous request, so a
  // slow earlier response cannot overwrite a newer one that came back faster.
  createEffect(() => {
    const current = runtime()
    const view = current?.tableViews[0]
    const term = search().trim()
    if (!current || !view) return

    const request = ++requestNumber
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    void current.client
      .listRecords(
        props.panel.id,
        view.id,
        { page: 1, pageSize: view.pageSize, search: term || undefined },
        { signal: controller.signal },
      )
      .then((result) => {
        if (!disposed && request === requestNumber) setRecords(result)
      })
      .catch((cause: unknown) => {
        if (disposed || request !== requestNumber) return
        if ((cause as { name?: string }).name === 'AbortError') return
        setError(normalizePanelError(cause, 'Could not load the record list'))
      })
  })

  const tableView = () => runtime()?.tableViews[0]
  const columns = () => tableView()?.fields.read ?? []
  const rows = () => records()?.data ?? []

  return (
    <div class="shell">
      <header class="head">
        <div>
          <h1>{props.panel.name}</h1>
          <p>{runtime()?.bootstrap.panel.description ?? 'A manifest-driven Hamolus panel'}</p>
        </div>
        <button type="button" class="btnGhost" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </header>

      <Show when={!loading()} fallback={<p class="empty" role="status">Loading panel…</p>}>
        <Show
          when={!error()}
          fallback={<ErrorPanel error={error()!} onRetry={() => window.location.reload()} />}
        >
          <Show when={metrics().length > 0}>
            <div class="metrics">
              <For each={metrics()}>
                {(metric) => (
                  <article class="metric">
                    <Show when={metric.group}>
                      <span class="metricGroup">{metric.group}</span>
                    </Show>
                    <span class="metricLabel">{metric.label}</span>
                    <strong class="metricValue">
                      {metric.value === null ? '—' : metric.value.toLocaleString('id-ID')}
                    </strong>
                  </article>
                )}
              </For>
            </div>
          </Show>

          <div class="toolbar">
            <input
              class="input"
              type="search"
              value={search()}
              placeholder="Search records"
              aria-label="Search records"
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </div>

          <Show
            when={rows().length > 0}
            fallback={<p class="empty" role="status">No records.</p>}
          >
            <div class="tableWrap">
              <table class="table">
                <thead>
                  <tr>
                    <For each={columns()}>{(field) => <th scope="col">{labelize(field)}</th>}</For>
                  </tr>
                </thead>
                <tbody>
                  <For each={rows()}>
                    {(record) => (
                      <tr>
                        <For each={columns()}>{(field) => <td>{render(record[field])}</td>}</For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}

function ErrorPanel(props: { error: PanelError; onRetry: () => void }) {
  return (
    <div class="alert" role="alert">
      <p class="alertTitle">{props.error.message}</p>
      <p class="alertCode">{props.error.code}</p>
      <button type="button" class="btn" onClick={props.onRetry}>
        Try again
      </button>
    </div>
  )
}

function labelize(field: string): string {
  return field
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function render(value: unknown) {
  if (value === null || value === undefined) return <span class="empty">—</span>
  if (typeof value === 'object') return <span class="empty">{JSON.stringify(value)}</span>
  return <>{String(value)}</>
}
