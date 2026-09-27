// Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>, MIT
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import {
  PanelError,
  createPanelClient,
  getPanelAssetUrl,
  isPanelAssetExpired,
  normalizePanelError,
} from '@hamolus/panel'
import type {
  PanelAssetListResponse,
  PanelBootstrap,
  PanelClient,
  PanelRecord,
  PanelRuntimeConfig,
} from '@hamolus/panel'
import { missingTokenMessage } from './panel'

/**
 * An example booking calendar panel.
 *
 * What sets this example apart from the other two panels:
 *
 *   1. **Language belongs to the core, not to the panel.** `getLocalization()` is read once,
 *      then `locale` is sent with every `listRecords`. If `VITE_PANEL_LOCALE` holds a code
 *      the core does not declare, that code is ignored and the core's `defaultLocale` is
 *      used — the panel never sends an invented language code to the core.
 *   2. **Private assets through signed URLs.** Photos or documents inside a panel have no
 *      public URL. `listAssets()` returns a short-lived URL along with its `expiresAt`, and
 *      `isPanelAssetExpired()` is used so a stale URL gets replaced rather than used.
 *   3. **Grouping on the client side.** The core returns a list of records; the grouping by
 *      date is done in the panel, because that is purely a presentation concern.
 */

type Runtime = {
  client: PanelClient
  bootstrap: PanelBootstrap
  viewId: string
  locales: string[]
  defaultLocale: string
}

type DayGroup = {
  date: string
  label: string
  records: PanelRecord[]
}

export function App(props: { panel: PanelRuntimeConfig }) {
  const [runtime, setRuntime] = createSignal<Runtime>()
  const [records, setRecords] = createSignal<PanelRecord[]>([])
  const [locale, setLocale] = createSignal<string | undefined>(props.panel.locale)
  const [date, setDate] = createSignal('')
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

        const [localization, bootstrap] = await Promise.all([
          client.getLocalization().catch(() => null),
          client.bootstrap(props.panel.id),
        ])
        if (disposed) return

        const viewId =
          bootstrap.panel.menu[0]?.viewId ??
          bootstrap.panel.views[0]?.id ??
          (() => {
            throw new Error('This panel has no view')
          })()

        const declared = localization?.locales.map((entry) => entry.code) ?? []
        const preselected = props.panel.locale
        setLocale(
          preselected && declared.includes(preselected)
            ? preselected
            : (localization?.defaultLocale ?? preselected),
        )

        setRuntime({
          client,
          bootstrap,
          viewId,
          locales: declared,
          defaultLocale: localization?.defaultLocale ?? '',
        })
      } catch (cause) {
        if (disposed) return
        const missing = missingTokenMessage(props.panel)
        setError(
          missing
            ? new PanelError(missing, { code: 'MISSING_TOKEN' })
            : normalizePanelError(cause, 'Could not load the booking panel'),
        )
      } finally {
        if (!disposed) setLoading(false)
      }
    })()
  })

  // Records are reloaded whenever the locale changes, so the core returns translations that
  // match the chosen language.
  //
  // Note: the panel SDK's `listRecords` has **no** filter parameter. `panelQuerySchema` in
  // `@hamolus/types` accepts only `page`, `pageSize`, `search`, `locale`, `sortBy`, and
  // `sortDir`, and being strict it rejects any other key. So date filtering is done in the
  // browser, in the `visible` memo below, not in the core.
  createEffect(() => {
    const current = runtime()
    if (!current) return
    const activeLocale = locale()
    const controller = new AbortController()
    onCleanup(() => controller.abort())

    void current.client
      .listRecords(
        props.panel.id,
        current.viewId,
        {
          page: 1,
          pageSize: 50,
          locale: activeLocale,
          sortBy: 'booked_at',
          sortDir: 'asc',
        },
        { signal: controller.signal },
      )
      .then((result) => {
        if (disposed || controller.signal.aborted) return
        setRecords(result.data)
      })
      .catch((cause: unknown) => {
        if (disposed || controller.signal.aborted) return
        if ((cause as { name?: string }).name === 'AbortError') return
        setError(normalizePanelError(cause, 'Could not load the bookings'))
      })
  })

  /**
   * The records after date filtering in the browser.
   *
   * The limit is an honest one: only the first 50 records take part in the filtering. If a
   * single date has more than 50 bookings, the rest stay invisible until `pageSize` is
   * raised. Moving the filtering to the server needs changes in `@hamolus/types` and
   * `@hamolus/panel` — not something the panel side can settle on its own.
   */
  const visible = createMemo<PanelRecord[]>(() => {
    const wanted = date().trim()
    if (!wanted) return records()
    return records().filter((record) => record.booked_date === wanted)
  })

  /** Records grouped by date; an empty date is placed at the end. */
  const groups = createMemo<DayGroup[]>(() => {
    const buckets = new Map<string, PanelRecord[]>()
    for (const record of visible()) {
      const key = typeof record.booked_date === 'string' ? record.booked_date : 'No date'
      const bucket = buckets.get(key)
      if (bucket) bucket.push(record)
      else buckets.set(key, [record])
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ date: key, label: formatDay(key), records: items }))
  })

  return (
    <div class="shell">
      <header class="head">
        <div>
          <h1>{props.panel.name}</h1>
          <p>{runtime()?.bootstrap.panel.description ?? 'Booking agenda'}</p>
        </div>
        <Show when={runtime()?.locales.length}>
          <div class="toolbar" role="group" aria-label="Language">
            <For each={runtime()!.locales}>
              {(code) => (
                <button
                  type="button"
                  classList={{ btn: locale() === code, btnGhost: locale() !== code }}
                  aria-pressed={locale() === code}
                  onClick={() => setLocale(code)}
                >
                  {code.toUpperCase()}
                </button>
              )}
            </For>
          </div>
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
              type="date"
              value={date()}
              aria-label="Filter by date"
              onInput={(event) => setDate(event.currentTarget.value)}
            />
            <Show when={date()}>
              <button type="button" class="btnGhost" onClick={() => setDate('')}>
                All dates
              </button>
            </Show>
          </div>

          <Show
            when={groups().length > 0}
            fallback={<p class="empty" role="status">No bookings match this filter.</p>}
          >
            <For each={groups()}>
              {(group) => (
                <section class="viewHead">
                  <div>
                    <h2 class="viewTitle">{group.label}</h2>
                    <p class="viewDesc">
                      {group.records.length} bookings
                    </p>
                  </div>
                  <div class="tableWrap">
                    <table class="table">
                      <thead>
                        <tr>
                          <th scope="col">Time</th>
                          <th scope="col">Guest</th>
                          <th scope="col">Status</th>
                          <th scope="col">Attachment</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={group.records}>
                          {(record) => (
                            <tr>
                              <td>{String(record.booked_at ?? '—')}</td>
                              <td>{String(record.customer_name ?? '—')}</td>
                              <td>{String(record.status ?? '—')}</td>
                              <td>
                                <AssetCell
                                  client={runtime()!.client}
                                  panelId={props.panel.id}
                                  viewId={runtime()!.viewId}
                                  record={record}
                                />
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </For>
          </Show>
        </Show>
      </Show>
    </div>
  )
}

/**
 * One attachment cell.
 *
 * Assets inside a panel are private: there is no permanent URL. `listAssets()` already
 * returns a signed `url` along with its `expiresAt`, so the panel never has to sign
 * anything itself — `getPanelAssetUrl()` only picks between the display URL and the
 * download URL, and `isPanelAssetExpired()` decides whether the signature it holds is still
 * valid. A stale URL is refreshed, not used.
 */
function AssetCell(props: {
  client: PanelClient
  panelId: string
  viewId: string
  record: PanelRecord
}) {
  const [assets, setAssets] = createSignal<PanelAssetListResponse>()
  const [expanded, setExpanded] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const request = async () => {
    setLoading(true)
    setError(undefined)
    try {
      setAssets(await props.client.listAssets(props.panelId, props.viewId, 'attachment'))
    } catch (cause) {
      setError(normalizePanelError(cause, 'Could not load the attachment').message)
    } finally {
      setLoading(false)
    }
  }

  const rows = () => assets()?.data ?? []
  const first = () => rows()[0]

  return (
    <div>
      <Show when={first()} fallback={
        <button type="button" class="btnGhost" disabled={loading()} onClick={() => void request()}>
          {loading() ? 'Loading…' : 'Get link'}
        </button>
      }>
        <a href={getPanelAssetUrl(first()!)} target="_blank" rel="noreferrer">
          {first()!.name}
        </a>
        <Show when={isPanelAssetExpired(first()!)}>
          <button
            type="button"
            class="btnGhost"
            onClick={() => void request()}
            title="The URL signature has expired"
          >
            Refresh
          </button>
        </Show>
        <Show when={rows().length > 1}>
          <button type="button" class="btnGhost" onClick={() => setExpanded((value) => !value)}>
            {expanded() ? 'Close' : `+${rows().length - 1} more`}
          </button>
        </Show>
        <Show when={expanded()}>
          <ul>
            <For each={rows().slice(1)}>
              {(asset) => (
                <li>
                  <a href={getPanelAssetUrl(asset, { download: true })}>{asset.name}</a>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
      <Show when={error()}>
        <p class="alertCode">{error()}</p>
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

/** A `YYYY-MM-DD` date becomes a readable label; any other input is shown as it came in. */
function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
