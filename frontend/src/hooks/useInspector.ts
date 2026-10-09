import { useQuery } from '@tanstack/react-query'
import { request } from '../api/client'
import type { InspectorSnapshot } from '../api/index'

export function useInspector(sessionId: string | null) {
  return useQuery({
    queryKey: ['inspector', sessionId],
    queryFn: () => request<InspectorSnapshot>(`/api/sessions/${sessionId}/inspector`),
    enabled: Boolean(sessionId),
    refetchInterval: 10_000,
  })
}