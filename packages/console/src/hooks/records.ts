/**
 * Copyright 2026 Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * Author: Gilang Albathin Nurhabibi <https://github.com/athron98>
 *
 * SPDX-License-Identifier: MIT
 *
 * Licensed under the MIT License. See the LICENSE file at the repository root.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/solid-query'
import { keepPreviousData } from '@tanstack/solid-query'
import type { SortDir } from '@hamolus/types'
import type { Accessor } from 'solid-js'
import { api, type RecordRow } from '../lib/api'
import { getCachedRecords, getHash, setCachedRecords, setHash } from '../lib/cache'
import { logActivity } from '../lib/activity'

export interface RecordsParams {
  name: string
  page: number
  pageSize: number
  sortBy?: string
  sortDir?: SortDir
  locale?: string
  search?: string
}

export function useRecords(params: Accessor<RecordsParams>) {
  return useQuery(() => {
    const p = params()
    return {
      queryKey: ['records', p.name, p.page, p.pageSize, p.sortBy, p.sortDir, p.locale, p.search] as const,
      queryFn: async () => {
        const storedHash = getHash(p.name)
        const { data: { lastUpdate: currentHash } } = await api.getLastUpdate(p.name)

        if (storedHash && storedHash === currentHash) {
          const hit = getCachedRecords(
            p.name,
            p.page,
            p.pageSize,
            p.locale ?? '',
            p.search ?? '',
            p.sortBy ?? '',
            p.sortDir ?? '',
          )
          if (hit) return { data: hit.data, meta: hit.meta, lastUpdate: currentHash }
        }

        const res = await api.listRecords(p.name, {
          page: p.page,
          pageSize: p.pageSize,
          sortBy: p.sortBy,
          sortDir: p.sortDir ?? 'desc',
          locale: p.locale,
          search: p.search,
        })
        setHash(p.name, currentHash)
        setCachedRecords(
          p.name,
          p.page,
          p.pageSize,
          p.locale ?? '',
          p.search ?? '',
          res.data,
          res.meta,
          p.sortBy ?? '',
          p.sortDir ?? '',
        )
        return { data: res.data, meta: res.meta, lastUpdate: currentHash }
      },
      placeholderData: keepPreviousData,
    }
  })
}

export function useSaveRecord(name: Accessor<string | undefined>) {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: ({ id, values }: { id?: string; values: Record<string, unknown> }) =>
      id ? api.updateRecord(name()!, id, values) : api.createRecord(name()!, values),
    onSuccess: (_data, vars) => {
      logActivity(
        vars.id ? 'record.update' : 'record.create',
        vars.id ? 'Updated record' : 'Created record',
        vars.id ? `${name()} · ${vars.id}` : name(),
      )
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['relations'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setHash(name()!, null)
    },
  }))
}

export function useDeleteRecord(name: Accessor<string | undefined>) {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (id: string) => api.deleteRecord(name()!, id),
    onSuccess: (_data, id) => {
      logActivity('record.delete', 'Deleted record', `${name()} · ${id}`)
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['relations'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setHash(name()!, null)
    },
  }))
}

export function useBulkDelete(name: Accessor<string | undefined>) {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (ids: string[]) => api.bulkDeleteRecords(name()!, ids),
    onSuccess: (_data, ids) => {
      logActivity('record.delete', 'Deleted records', `${name()} · ${ids.length}`)
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['relations'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setHash(name()!, null)
    },
  }))
}

export type { RecordRow }
