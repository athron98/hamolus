/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createEffect, createMemo, createSignal, Match, on, onMount, Show, Switch } from 'solid-js'
import { useBeforeLeave, useParams } from '@solidjs/router'
import type { BeforeLeaveEventArgs } from '@solidjs/router'
import * as stylex from '@stylexjs/stylex'
import type { SortDir } from '@hamolus/types'
import { s, tokens } from '../theme.stylex'
import { RecordForm } from '../components/RecordForm'
import { Table } from '../components/Table'
import { Collapsible } from '../components/Collapsible'
import { CollectionDefinition } from '../components/CollectionDefinition'
import { Sheet, type SheetApi } from '../components/Sheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChevronLeftIcon, ChevronRightIcon, PinIcon, PlusIcon } from '../components/Icons'
import { useCollections } from '../hooks/collections'
import { useGroups } from '../hooks/groups'
import { useDeleteRecord, useBulkDelete, useRecords, useSaveRecord, type RecordRow } from '../hooks/records'
import { api } from '../lib/api'
import { locale } from '../lib/locale'
import { pinned, togglePin } from '../lib/prefs'
import { useLocalization } from '../hooks/localization'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const
const PAGE_SIZE_KEY = 'console-page-size'
const SORT_KEY = 'console-sort'

function loadPageSize(name: string): number {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_KEY)
    if (!raw) return DEFAULT_PAGE_SIZE
    const map = JSON.parse(raw) as Record<string, number>
    const v = Number(map[name])
    return Number.isFinite(v) && v >= 1 && v <= 100 ? Math.round(v) : DEFAULT_PAGE_SIZE
  } catch {
    return DEFAULT_PAGE_SIZE
  }
}

function savePageSize(name: string, size: number): void {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_KEY)
    const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[name] = size
    localStorage.setItem(PAGE_SIZE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function loadSort(name: string): { by: string | null; dir: SortDir } {
  try {
    const raw = localStorage.getItem(SORT_KEY)
    if (!raw) return { by: null, dir: 'asc' }
    const map = JSON.parse(raw) as Record<string, { by?: string; dir?: SortDir }>
    const s = map[name]
    if (s && typeof s.by === 'string' && (s.dir === 'asc' || s.dir === 'desc')) {
      return { by: s.by, dir: s.dir }
    }
    return { by: null, dir: 'asc' }
  } catch {
    return { by: null, dir: 'asc' }
  }
}

function saveSort(name: string, by: string | null, dir: SortDir): void {
  try {
    const raw = localStorage.getItem(SORT_KEY)
    const map: Record<string, { by: string | null; dir: SortDir }> = raw ? JSON.parse(raw) : {}
    map[name] = { by, dir }
    localStorage.setItem(SORT_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

const styles = stylex.create({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  pinActive: {
    color: tokens.accent,
    backgroundColor: tokens.accentSoft,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  sizeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  sizeLabel: {
    fontSize: 11,
    color: tokens.textDim,
  },
  select: {
    width: 'auto',
    minWidth: 96,
    padding: '6px 28px 6px 10px',
    fontSize: 12,
    color: tokens.text,
    backgroundColor: tokens.bg,
    boxShadow: tokens.shadowInput,
    borderStyle: 'none',
    borderRadius: tokens.radiusSm,
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2398a1b4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    transition: `box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1)`,
    cursor: 'pointer',
    ':focus': {
      boxShadow: tokens.shadowInputFocus,
    },
  },
  sizeInput: {
    width: 64,
    padding: '6px 8px',
    fontSize: 12,
  },
})

export function CollectionPage() {
  const params = useParams<{ collection: string }>()
  const name = () => params.collection
  const collections = useCollections()
  const collection = createMemo(() => collections.data?.find((c) => c.name === name()))
  const groupDefs = useGroups()
  const groupLabel = (id: string | null | undefined) =>
    groupDefs.data?.find((g) => g.id === id)?.label ?? id ?? null

  const [page, setPage] = createSignal(1)
  const [pageSize, setPageSize] = createSignal(loadPageSize(name()))
  const [sizeCustom, setSizeCustom] = createSignal(!(PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize()))
  const [search, setSearch] = createSignal('')
  const [sortBy, setSortBy] = createSignal<string | null>(null)
  const [sortDir, setSortDir] = createSignal<SortDir>('asc')
  const records = useRecords(() => ({
    name: name(),
    page: page(),
    pageSize: pageSize(),
    sortBy: sortBy() ?? undefined,
    sortDir: sortDir(),
    locale: locale(),
    search: search(),
  }))

  const [selected, setSelected] = createSignal<RecordRow | null>(null)
  const [creating, setCreating] = createSignal(false)
  const [formError, setFormError] = createSignal<string | null>(null)
  const localization = useLocalization()
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

  createEffect(
    on(name, () => {
      setCreating(false)
      setSelected(null)
      setDirty(false)
      setConfirmState(null)
      setFormError(null)
      setPage(1)
      setSearch('')
      const s = loadSort(name())
      setSortBy(s.by)
      setSortDir(s.dir)
    }),
  )

  const save = useSaveRecord(name)
  const remove = useDeleteRecord(name)
  const bulkRemove = useBulkDelete(name)

  const deleteRows = async (ids: string[]): Promise<boolean> => {
    if (!confirm(`Delete ${ids.length} selected records?`)) return false
    try {
      await bulkRemove.mutateAsync(ids)
      for (const id of ids) {
        if (selected() && idOf(selected()!) === id) setSelected(null)
      }
      return true
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete records')
      return false
    }
  }

  const idOf = (row: RecordRow) => String(row[collection()?.primaryKey ?? 'id'] ?? '')

  const openCreate = () => {
    setCreating(true)
    setSelected(null)
  }

  const cancelForm = () => {
    setCreating(false)
    setSelected(null)
    setDirty(false)
  }

  const requestClose = (): boolean | Promise<boolean | void> => {
    if (confirmState()) return false
    if (!dirty()) return true
    return new Promise<boolean>((resolve) => {
      setConfirmState({ kind: 'close', resolve })
    })
  }

  const selectRow = async (row: RecordRow) => {
    setCreating(false)
    try {
      const fresh = await api.getRecord(name(), idOf(row))
      setSelected(fresh.data)
    } catch {
      setSelected(row)
    }
  }

  const submit = async (values: Record<string, unknown>) => {
    setFormError(null)
    try {
      if (selected()) {
        await save.mutateAsync({ id: idOf(selected()!), values })
      } else {
        await save.mutateAsync({ values })
      }
      cancelForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save record')
    }
  }

  const deleteRow = async (row: RecordRow) => {
    if (!confirm('Delete this record?')) return
    try {
      await remove.mutateAsync(idOf(row))
      if (selected() && idOf(selected()!) === idOf(row)) setSelected(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete record')
    }
  }

  const totalPages = () => records.data?.meta.totalPages ?? 1
  const total = () => records.data?.meta.total ?? 0

  const chooseSize = (size: number) => {
    const clamped = Math.min(100, Math.max(1, Math.round(size)))
    setPageSize(clamped)
    setSizeCustom(!(PAGE_SIZE_OPTIONS as readonly number[]).includes(clamped))
    savePageSize(name(), clamped)
    setPage(1)
  }

  const onSizeSelect = (e: Event) => {
    const v = (e.currentTarget as HTMLSelectElement).value
    if (v === 'custom') {
      setSizeCustom(true)
      return
    }
    chooseSize(Number(v))
  }

  const toggleSort = (field: string) => {
    if (sortBy() === field) {
      if (sortDir() === 'asc') {
        setSortDir('desc')
        saveSort(name(), field, 'desc')
      } else {
        setSortBy(null)
        saveSort(name(), null, 'asc')
      }
    } else {
      setSortBy(field)
      setSortDir('asc')
      saveSort(name(), field, 'asc')
    }
    setPage(1)
  }

  return (
    <div {...stylex.props(s.page)}>
      <Show when={collection()} fallback={<p {...stylex.props(s.muted)}>Loading…</p>}>
        <div {...stylex.props(styles.header)}>
          <div>
            <h1 {...stylex.props(s.heading)}>{collection()!.label}</h1>
            <p {...stylex.props(s.subheading)}>
              {name()} — {total()} {total() === 1 ? 'record' : 'records'}
            </p>
          </div>
          <div {...stylex.props(styles.headerActions)}>
            <button
              type="button"
              onClick={() => togglePin(name())}
              title={
                pinned().includes(name())
                  ? `Unpin ${collection()!.label}`
                  : `Pin ${collection()!.label} to the navbar`
              }
              aria-label="Pin collection"
              aria-pressed={pinned().includes(name())}
              {...stylex.props(s.btnIcon, pinned().includes(name()) && styles.pinActive)}
            >
              <PinIcon size={15} />
            </button>
            <button
              type="button"
              onClick={openCreate}
              title="New record"
              aria-label="New record"
              {...stylex.props(s.btnIcon)}
            >
              <PlusIcon size={15} />
            </button>
          </div>
        </div>

        <Collapsible id={`${name()}:records`} title="Records" meta={`${total()} total`}>
          <Table
            collection={collection()!}
            rows={records.data?.data ?? []}
            selectedId={selected() ? idOf(selected()!) : null}
            onSelect={selectRow}
            onDelete={deleteRow}
            locale={locale()}
            search={search()}
            onSearchChange={(q) => {
              setSearch(q)
              setPage(1)
            }}
            sortBy={sortBy() ?? undefined}
            sortDir={sortDir()}
            onSort={toggleSort}
            onBulkDelete={deleteRows}
          />

          <Show when={records.data && total() > 0}>
            <div {...stylex.props(styles.pagination)}>
              <button
                type="button"
                aria-label="Previous page"
                title="Previous page"
                disabled={page() <= 1 || records.isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                {...stylex.props(s.btnIcon)}
              >
                <ChevronLeftIcon size={15} />
              </button>
              <span {...stylex.props(s.muted)}>
                Page {records.data?.meta.page ?? page()} of {totalPages()}
              </span>
              <button
                type="button"
                aria-label="Next page"
                title="Next page"
                disabled={page() >= totalPages() || records.isLoading}
                onClick={() => setPage((p) => p + 1)}
                {...stylex.props(s.btnIcon)}
              >
                <ChevronRightIcon size={15} />
              </button>

              <div {...stylex.props(styles.sizeControl)}>
                <span {...stylex.props(styles.sizeLabel)}>Per page</span>
                <select
                  onInput={onSizeSelect}
                  {...stylex.props(styles.select)}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option
                      value={n}
                      selected={!sizeCustom() && String(pageSize()) === String(n)}
                    >
                      {n}
                    </option>
                  ))}
                  <option value="custom" selected={sizeCustom()}>Custom…</option>
                </select>
                <Show when={sizeCustom()}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={pageSize()}
                    onInput={(e) => {
                      const v = Number(e.currentTarget.value)
                      if (Number.isFinite(v) && v >= 1 && v <= 100) chooseSize(v)
                    }}
                    {...stylex.props(s.input, styles.sizeInput)}
                  />
                </Show>
              </div>
            </div>
          </Show>
        </Collapsible>

        <Collapsible
          id={`${name()}:definition`}
          title="Definition"
          meta={`${collection()!.fields.length} fields`}
        >
          <CollectionDefinition collection={collection()!} groupLabel={groupLabel} />
        </Collapsible>
      </Show>

      <Show when={creating() || selected() !== null}>
        <Sheet
          title={
            creating()
              ? `New ${collection()!.label}`
              : selected()
                ? `Edit ${collection()!.label}`
                : collection()!.label
          }
          onCloseRequest={requestClose}
          onExited={cancelForm}
          onReady={(api) => {
            sheet = api
          }}
        >
          <Show when={formError()}>
            <p {...stylex.props(s.error)}>{formError()}</p>
          </Show>
          <Switch>
            <Match when={creating()}>
              <RecordForm
                collection={collection()!}
                record={null}
                busy={save.isPending}
                onSubmit={submit}
                onCancel={() => sheet?.requestClose()}
                onDirtyChange={setDirty}
                languages={localization.languages()}
                locale={locale()}
              />
            </Match>
            <Match when={selected() !== null}>
              <RecordForm
                collection={collection()!}
                record={selected()}
                busy={save.isPending}
                onSubmit={submit}
                onCancel={() => sheet?.requestClose()}
                onDelete={deleteRow}
                onDirtyChange={setDirty}
                languages={localization.languages()}
                locale={locale()}
              />
            </Match>
          </Switch>
        </Sheet>
      </Show>

      <Show when={confirmState()}>
        <ConfirmDialog
          title="Discard changes?"
          message={
            confirmState()!.kind === 'leave'
              ? `You are about to leave ${collection()!.label} without saving. Unsaved edits will be lost.`
              : `You have unsaved edits in this ${collection()!.label} record. Discard them and close the form?`
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
    </div>
  )
}