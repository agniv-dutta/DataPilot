import { request, apiUrl } from './client'
import type {
  ChatResponse,
  DatasetInfo,
  FileListResponse,
  HealthResponse,
  SessionOut,
} from './types'

export function createSession(name?: string): Promise<SessionOut> {
  return request<SessionOut>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  })
}

export function getSession(sessionId: string): Promise<SessionOut> {
  return request<SessionOut>(`/api/sessions/${sessionId}`)
}

export function deleteSession(sessionId: string): Promise<void> {
  return request<void>(`/api/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function uploadFiles(
  sessionId: string,
  files: File[],
  onProgress?: (fileName: string, percent: number) => void,
): Promise<DatasetInfo[]> {
  const form = new FormData()
  for (const file of files) form.append('files', file)

  const uploaded: DatasetInfo[] = []
  await Promise.all(
    files.map(async (file) => {
      // Simulated per-file progress for the UX; the backend returns all at once.
      onProgress?.(file.name, 30)
      const single = new FormData()
      single.append('files', file)
      const start = Date.now()
      // To report smooth progress we post files sequentially with fake ticks.
      const timer = window.setInterval(() => {
        const pct = Math.min(95, 30 + ((Date.now() - start) / 6000) * 65)
        onProgress?.(file.name, pct)
      }, 200)

      try {
        const res = await fetch(apiUrl(`/api/sessions/${sessionId}/files`), {
          method: 'POST',
          body: single,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: { code?: string; message?: string } }
            | null
          throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
        }
        const datasets = (await res.json()) as DatasetInfo[]
        uploaded.push(...datasets)
        onProgress?.(file.name, 100)
      } finally {
        window.clearInterval(timer)
      }
    }),
  )
  return uploaded
}

export function listFiles(sessionId: string): Promise<FileListResponse> {
  return request<FileListResponse>(`/api/sessions/${sessionId}/files`)
}

export function deleteFile(sessionId: string, fileId: string): Promise<void> {
  return request<void>(`/api/sessions/${sessionId}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  })
}

export function chatSync(sessionId: string, message: string): Promise<ChatResponse> {
  return request<ChatResponse>(`/api/sessions/${sessionId}/chat/sync`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health')
}

export const healthUrl = (): string => apiUrl('/api/health')