// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { PanelError, createPanelClient, normalizePanelError } from '@hamolus/panel'
import type {
  PanelBootstrap,
  PanelClient,
  PanelRecord,
  PanelRecordInput,
  PanelRuntimeConfig,
  PanelTableViewDefinition,
} from '@hamolus/panel'
import { missingTokenMessage } from './panel'

/**
 * An example panel that writes data.
 *
 * It differs from seo-dashboard in three ways, and all three matter once this is used in
 * production:
 *
 *   1. **Writing via a view, not a collection.** `updateRecord(panelId, viewId, recordId,`
 *     `input)` leaves the decision to the core. Fields outside `fields.write` come back as a
 *     403, so the panel never has to guess what an account is allowed to do.
 *   2. **Optimistic update with rollback.** The new number shows straight away so the stock
 *     figure feels responsive; if the request fails, the old value is restored and the reason
 *     is shown. Waiting for the round trip before repainting feels slow, and if the error
 *     disappears on its own the user assumes the save went through.
 *   3. **One error per row, not one global error.** A mistake on a single product must not
 *     wipe out the whole table.
 */

type Runtime = {
  client: PanelClient
  bootstrap: PanelBootstrap
  view: PanelTableViewDefinition
}

type RowError = {
  recordId: string
  code: string
  message: string
}

export function App(props: { panel: PanelRuntimeConfig }) {
  const [runtime, setRuntime] = createSignal<Runtime>()
  const [records, setRecords] = createSignal<PanelRecord[]>([])
  const [drafts, setDrafts] = createSignal<Record<string, number>>({})
  const [saving, setSaving] = createSignal<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = createSignal<Record<string, RowError>>({})
  const [search, setSearch] = createSignal('')
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<PanelError>()
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

        const view = bootstrap.panel.views.find(
          (candidate): candidate is PanelTableViewDefinition => candidate.kind === 'table',
        )
        if (!view) throw new Error('This panel has no table view')

        setRuntime({ client, bootstrap, view })
      } catch (cause) {
        if (disposed) return
        const missing = missingTokenMessage(props.panel)
        setError(
          missing
            ? new PanelError(missing, { code: 'MISSING_TOKEN' })
            : normalizePanelError(cause, 'Could not load the inventory panel'),
        )
      } finally {
        if (!disposed) setLoading(false)
      }
    })()
  })

  // Reload the list whenever the search changes. The previous request is aborted rather
  // than merely ignored: otherwise a slow earlier request can overwrite the new results.
  createEffect(() => {
    const current = runtime()
    if (!current) return
    const term = search().trim()
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    void current.client
      .listRecords(
        props.panel.id,
        current.view.id,
        { page: 1, pageSize: current.view.pageSize, search: term || undefined },
        { signal: controller.signal },
      )
      .then((result) => {
        if (disposed || controller.signal.aborted) return
        setRecords(result.data)
        setDrafts({})
        setRowErrors({})
      })
      .catch((cause: unknown) => {
        if (disposed || controller.signal.aborted) return
        if ((cause as { name?: string }).name === 'AbortError') return
        setError(normalizePanelError(cause, 'Could not load the product list'))
      })
  })

  const view = () => runtime()?.view
  const readableFields = () => view()?.fields.read ?? []
  const writableFields = () => view()?.fields.write ?? []

  /** What to show: the user's draft when there is one, otherwise the value from the server. */
  const stockOf = (record: PanelRecord): number => {
    const draft = drafts()[rowId(record)]
    if (draft !== undefined) return draft
    return numberOf(record.quantity)
  }

  function setDraft(recordId: string, value: number) {
    setDrafts((current) => ({ ...current, [recordId]: value }))
    setRowErrors((current) => {
      if (!current[recordId]) return current
      const next = { ...current }
      delete next[recordId]
      return next
    })
  }

  /**
   * Save one row.
   *
   * The old value is kept first so it can be restored if the core rejects the change. The
   * core's response is the source of truth: the row is replaced with the record the core
   * returned rather than with the local input, because the core fills in derived fields
   * such as `updated_at`.
   */
  async function saveStock(record: PanelRecord) {
    const current = runtime()
    if (!current || saving()[rowId(record)]) return

    const previous = numberOf(record.quantity)
    const next = drafts()[rowId(record)]
    if (next === undefined || next === previous) return

    const input: PanelRecordInput = { quantity: next }
    setSaving((state) => ({ ...state, [rowId(record)]: true }))

    try {
      const updated = await current.client.updateRecord(
        props.panel.id,
        current.view.id,
        rowId(record),
        input,
      )
      if (disposed) return
      setRecords((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
      setDrafts((state) => {
        const copy = { ...state }
        delete copy[rowId(record)]
        return copy
      })
    } catch (cause) {
      if (disposed) return
      const normalized = normalizePanelError(cause, 'Could not save the stock')
      setRowErrors((state) => ({
        ...state,
        [rowId(record)]: { recordId: rowId(record), code: normalized.code, message: normalized.message },
      }))
      // The input value is dropped so the user can see which number did not save.
      setDrafts((state) => {
        const copy = { ...state }
        delete copy[rowId(record)]
        return copy
      })
      if (normalized.code === 'FORBIDDEN') {
        setError(
          new PanelError(
            'This account may not change that field. Check fields.write in the panel manifest.',
            { code: normalized.code, status: 403 },
          ),
        )
      }
    } finally {
      if (!disposed) {
        setSaving((state) => {
          const copy = { ...state }
          delete copy[rowId(record)]
          return copy
        })
      }
    }
  }

  return (
    <div class="shell">
      <header class="head">
        <div>
          <h1>{props.panel.name}</h1>
          <p>{runtime()?.bootstrap.panel.description ?? 'Recount warehouse stock'}</p>
        </div>
        <Show when={view()}>
          <span class="empty">
            Writable: {writableFields().join(', ') || '—'}
          </span>
        </Show>
      </header>

      <Show when={!loading()} fallback={<p class="empty" role="status">Loading panel…</p>}>
        <Show
          when={!error()}
          fallback={<ErrorPanel error={error()!} onRetry={() => window.location.reload()} />}
        >
          <div class="toolbar">
            <input
              class="input"
              type="search"
              value={search()}
              placeholder="Search SKU or name"
              aria-label="Search products"
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </div>

          <Show when={records().length > 0} fallback={<p class="empty" role="status">No products.</p>}>
            <div class="tableWrap">
              <table class="table">
                <thead>
                  <tr>
                    <For each={readableFields()}>{(field) => <th scope="col">{labelize(field)}</th>}</For>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={records()}>
                    {(record) => {
                      const rowError = () => rowErrors()[rowId(record)]
                      const dirty = () => drafts()[rowId(record)] !== undefined
                      return (
                        <tr>
                          <For each={readableFields()}>
                            {(field) => (
                              <td>
                                <Show
                                  when={field === 'quantity'}
                                  fallback={<>{render(record[field])}</>}
                                >
                                  <input
                                    class="input"
                                    type="number"
                                    min="0"
                                    aria-label={`Stock ${record.sku ?? rowId(record)}`}
                                    value={stockOf(record)}
                                    disabled={!writableFields().includes('quantity')}
                                    onInput={(event) => setDraft(rowId(record), event.currentTarget.valueAsNumber)}
                                  />
                                </Show>
                              </td>
                            )}
                          </For>
                          <td>
                            <Show
                              when={!saving()[rowId(record)] && dirty()}
                              fallback={<span class="empty">Saving…</span>}
                            >
                              <button
                                type="button"
                                class="btn"
                                onClick={() => void saveStock(record)}
                              >
                                Save
                              </button>
                            </Show>
                            <Show when={rowError()}>
                              {(current) => (
                                <p class="alertCode">
                                  {current().message} ({current().code})
                                </p>
                              )}
                            </Show>
                          </td>
                        </tr>
                      )
                    }}
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

/**
 * A record id as a string.
 *
 * `PanelRecord` is a `Record<string, unknown>`, so `record.id` is typed `unknown`. The id is
 * used both as a row key and as a path argument, so it has to be a string. `String(...)` is
 * used without a non-null assertion so this stays safe when the core sends a row with no
 * id, and so one broken row cannot fail the panel's build.
 */
function rowId(record: PanelRecord): string {
  return String(record.id ?? '')
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
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
