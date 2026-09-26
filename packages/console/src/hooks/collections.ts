import { useMutation, useQuery, useQueryClient } from '@tanstack/solid-query'
import type { CollectionDefinition } from '@hamolus/types'
import { api } from '../lib/api'
import { logActivity } from '../lib/activity'

export function useCollections() {
  return useQuery(() => ({
    queryKey: ['collections'] as const,
    queryFn: async () => (await api.listCollections()).data,
  }))
}

export function useSaveCollection() {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (def: CollectionDefinition) => api.putCollection(def.name, def),
    onSuccess: (_data, def) => {
      const existing = queryClient.getQueryData<CollectionDefinition[]>(['collections'])
      const wasNew = !existing?.some((c) => c.name === def.name)
      logActivity(
        wasNew ? 'collection.create' : 'collection.update',
        wasNew ? 'Created collection' : 'Updated collection',
        def.name,
      )
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  }))
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation(() => ({
    mutationFn: (name: string) => api.deleteCollection(name),
    onSuccess: (_data, name) => {
      logActivity('collection.delete', 'Deleted collection', name)
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  }))
}