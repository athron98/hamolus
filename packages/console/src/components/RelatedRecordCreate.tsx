/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { createSignal, Show } from 'solid-js'
import { useQueryClient } from '@tanstack/solid-query'
import * as stylex from '@stylexjs/stylex'
import { s, tokens } from '../theme.stylex'
import { Sheet } from './Sheet'
import { RecordForm } from './RecordForm'
import { useRelationContext, type RelationContext } from '../lib/relations'
import { api, type RecordRow } from '../lib/api'
import { locale } from '../lib/locale'
import { setHash } from '../lib/cache'
import { logActivity } from '../lib/activity'

let uid = 0

const styles = stylex.create({
  status: {
    padding: '10px 2px 6px',
    fontSize: 13,
    color: tokens.textDim,
  },
})

/**
 * Popup to create a new record in a relation's target collection. After a
 * successful create the relation context cache is updated so the new record is
 * immediately selectable, then `onCreated(row, id)` hands the row to the caller
 * (which auto-selects it for belongsTo, or appends it for hasMany).
 */
export function RelatedRecordCreate(props: {
  target: string
  languages?: string[]
  onClose: () => void
  onCreated: (row: RecordRow, id: string) => void
}) {
  uid += 1
  const formId = `related-record-form-${uid}`
  const queryClient = useQueryClient()
  const ctx = useRelationContext(() => props.target)
  const def = () => ctx.data?.def
  const pk = () => ctx.data?.pk ?? 'id'
  const [busy, setBusy] = createSignal(false)
  const [formError, setFormError] = createSignal<string | null>(null)

  const submit = async (values: Record<string, unknown>) => {
    setFormError(null)
    setBusy(true)
    try {
      const res = await api.createRecord(props.target, values)
      const row = res.data
      const id = String(row[pk()] ?? '')
      logActivity('record.create', 'Created record', `${props.target} · ${id}`)
      setHash(props.target, null)
      const label = String(row[ctx.data?.labelField ?? ''] ?? '') || id
      queryClient.setQueryData<RelationContext>(
        ['relations', 'context', props.target, locale()],
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            rows: [...prev.rows, row],
            options: [...prev.options, { value: id, label }],
          }
        },
      )
      queryClient.invalidateQueries({ queryKey: ['relations'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      props.onCreated(row, id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create record')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Show when={ctx.isSuccess && def()} fallback={
      <Show when={ctx.isSuccess}>
        <Sheet title={`Create ${props.target}`} onCloseRequest={() => true} onExited={props.onClose}>
          <div {...stylex.props(styles.status)}>
            Target collection '{props.target}' is not registered in the API.
          </div>
        </Sheet>
      </Show>
    }>
      <Sheet
        title={def()!.label}
        onCloseRequest={() => !busy()}
        onExited={props.onClose}
      >
        <Show when={formError()}>
          <p {...stylex.props(s.error)}>{formError()}</p>
        </Show>
        <RecordForm
          collection={def()!}
          record={null}
          busy={busy()}
          submitLabel="Create"
          formId={formId}
          onSubmit={submit}
          onCancel={() => {
            if (!busy()) props.onClose()
          }}
          languages={props.languages}
        />
      </Sheet>
    </Show>
  )
}