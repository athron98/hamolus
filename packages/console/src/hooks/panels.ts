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
import type { PanelDefinition } from '@hamolus/types'
import { api } from '../lib/api'
import { logActivity } from '../lib/activity'

export function usePanels() {
  return useQuery(() => ({
    queryKey: ['panels'] as const,
    queryFn: async () => (await api.listPanels()).data,
  }))
}

export function useSavePanel() {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (input: { id?: string; definition: PanelDefinition }) =>
      input.id ? api.updatePanel(input.id, input.definition) : api.createPanel(input.definition),
    onSuccess: (_data, input) => {
      const existing = queryClient.getQueryData<PanelDefinition[]>(['panels'])
      const wasNew = !input.id && !existing?.some((panel) => panel.id === input.definition.id)
      logActivity(
        wasNew ? 'panel.create' : 'panel.update',
        wasNew ? 'Created panel' : 'Updated panel',
        input.definition.id,
      )
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  }))
}

export function useDeletePanel() {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (id: string) => api.deletePanel(id),
    onSuccess: (_data, id) => {
      logActivity('panel.delete', 'Deleted panel', id)
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  }))
}
