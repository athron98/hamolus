import { useMutation, useQuery, useQueryClient } from '@tanstack/solid-query'
import type { GroupDefinition } from '@hamolus/types'
import { api } from '../lib/api'
import { logActivity } from '../lib/activity'

export function useGroups() {
  return useQuery(() => ({
    queryKey: ['groups'] as const,
    queryFn: async () => (await api.listGroups()).data,
  }))
}

export function useSaveGroup() {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (def: GroupDefinition) => api.putGroup(def.id, def),
    onSuccess: (_data, def) => {
      const existing = queryClient.getQueryData<GroupDefinition[]>(['groups'])
      const wasNew = !existing?.some((g) => g.id === def.id)
      logActivity(
        wasNew ? 'group.create' : 'group.update',
        wasNew ? 'Created group' : 'Updated group',
        def.id,
      )
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  }))
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (id: string) => api.deleteGroup(id),
    onSuccess: (_data, id) => {
      logActivity('group.delete', 'Deleted group', id)
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  }))
}