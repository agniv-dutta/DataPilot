import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteFile, listFiles, uploadFiles } from '../api'
import type { DatasetInfo } from '../api/types'

export function useDatasets(sessionId: string | null) {
  const queryClient = useQueryClient()
  const enabled = Boolean(sessionId)

  const list = useQuery({
    queryKey: ['datasets', sessionId],
    queryFn: () => listFiles(sessionId ?? ''),
    enabled,
  })

  const upload = useMutation({
    mutationFn: ({
      files,
      onProgress,
    }: {
      files: File[]
      onProgress?: (name: string, percent: number) => void
    }) => uploadFiles(sessionId ?? '', files, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['datasets', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['inspector', sessionId] })
    },
  })

  const remove = useMutation({
    mutationFn: (fileId: string) => deleteFile(sessionId ?? '', fileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['datasets', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['inspector', sessionId] })
    },
  })

  const datasets: DatasetInfo[] = list.data?.datasets ?? []
  return { list, upload, remove, datasets }
}