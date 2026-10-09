import { useCallback, useRef, useState } from 'react'
import type { ChatEvent } from '../api/types'

export interface StreamState {
  connected: boolean
  events: ChatEvent[]
}

/**
 * POST to the SSE chat endpoint and parse `event:`/`data:` frames.
 */
export function useChatStream(sessionId: string | null) {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const finalRef = useRef(false)
  const stoppedRef = useRef(false)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    finalRef.current = false
    stoppedRef.current = false
    setEvents([])
    setError(null)
    setConnected(false)
  }, [])

  /** Abort the in-flight request without discarding already-streamed events. */
  const stop = useCallback(() => {
    stoppedRef.current = true
    abortRef.current?.abort()
    setConnected(false)
  }, [])

  const send = useCallback(
    async (message: string, syncFallback?: () => Promise<ChatEvent | null>) => {
      if (!sessionId) return
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      finalRef.current = false
      stoppedRef.current = false
      setError(null)
      setEvents([])
      setConnected(true)

      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
      const url = `${base.replace(/\/$/, '')}/api/sessions/${sessionId}/chat`

      const parseFrame = (frame: string) => {
        let eventType: string | null = null
        const dataLines: string[] = []
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim()
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
        }
        if (!dataLines.length) return
        let payload: unknown
        try {
          payload = JSON.parse(dataLines.join('\n'))
        } catch {
          return
        }
        const evt = { type: eventType, ...(payload as Record<string, unknown>) } as ChatEvent
        setEvents((prev) => [...prev, evt])
        if (eventType === 'final' || eventType === 'error') finalRef.current = true
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
          signal: abortRef.current.signal,
        })
        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed: HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''
          for (const frame of frames) {
            if (frame.trim()) {
              parseFrame(frame)
              if (finalRef.current) break
            }
          }
          if (finalRef.current) {
            abortRef.current?.abort()
            break
          }
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        if (!aborted) {
          setError(err instanceof Error ? err.message : 'Stream failed')
        }
      } finally {
        setConnected(false)
        if (!finalRef.current && !stoppedRef.current && syncFallback) {
          try {
            const synced = await syncFallback()
            if (synced) {
              finalRef.current = true
              setEvents([synced])
            }
          } catch {
            setError('The backend could not produce an answer.')
          }
        }
      }
    },
    [sessionId],
  )

  return { events, connected, error, send, reset, stop }
}