import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, getSession } from '../api'
import { useToast } from './useToast'

const STORAGE_KEY = 'dp-session'

/**
 * Owns the active session id. Auto-creates one on load and persists it in
 * sessionStorage so refreshes keep the conversation. Validates a restored id
 * against the backend (a server restart invalidates it) and silently replaces.
 */
export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const bootstrapped = useRef(false)
  const { show } = useToast()

  const start = useCallback(async () => {
    setCreating(true)
    try {
      const session = await createSession()
      sessionStorage.setItem(STORAGE_KEY, session.session_id)
      setSessionId(session.session_id)
    } catch (err) {
      show({
        tone: 'error',
        title: 'Could not start a session',
        description: err instanceof Error ? err.message : 'Backend unreachable',
      })
    } finally {
      setCreating(false)
    }
  }, [show])

  useEffect(() => {
    // Guard survives React 18 StrictMode's double effect invocation.
    if (bootstrapped.current) return
    bootstrapped.current = true
    const bootstrap = async () => {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          await getSession(stored)
          setSessionId(stored)
          return
        } catch {
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }
      void start()
    }
    void bootstrap()
  }, [start])

  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setSessionId(null)
    void start()
  }, [start])

  return { sessionId, creating, start, reset }
}
