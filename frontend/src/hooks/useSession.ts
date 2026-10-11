import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, getSession } from '../api'
import { ApiError } from '../api/client'
import { useToast } from './useToast'

const STORAGE_KEY = 'dp-session'
/** Delays before each retry — the session must exist before anything else works. */
const RETRY_DELAYS_MS = [0, 700, 1800, 4000]

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/**
 * Owns the active session id. Auto-creates one on load (retrying through
 * transient backend failures) and persists it in sessionStorage so refreshes
 * keep the conversation. A restored id is validated against the backend: a
 * server restart (4xx) replaces it, a network outage keeps it for later.
 */
export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  // Starts true: on first paint the app is always resolving a session
  // (restore, validate or create), never idle at "No session".
  const [creating, setCreating] = useState(true)
  const [failed, setFailed] = useState(false)
  const bootstrapped = useRef(false)
  const starting = useRef(false)
  const { show } = useToast()

  const start = useCallback(async () => {
    if (starting.current) return
    starting.current = true
    setCreating(true)
    setFailed(false)
    let lastError: unknown = null
    try {
      for (const delay of RETRY_DELAYS_MS) {
        if (delay) await wait(delay)
        try {
          const session = await createSession()
          sessionStorage.setItem(STORAGE_KEY, session.session_id)
          setSessionId(session.session_id)
          return
        } catch (err) {
          lastError = err
        }
      }
      setFailed(true)
      show({
        tone: 'error',
        title: 'Could not start a session',
        description: lastError instanceof Error ? lastError.message : 'Backend unreachable',
      })
    } finally {
      starting.current = false
      setCreating(false)
    }
  }, [show])

  // Resolve a usable session: validate a stored id (backend restarts replace
  // it, outages keep it and surface the unreachable screen) or create a new one.
  const resolve = useCallback(async () => {
    setCreating(true)
    setFailed(false)
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          await getSession(stored)
          setSessionId(stored)
          return
        } catch (err) {
          const reachable = !(err instanceof ApiError && err.status === 0)
          if (!reachable) {
            // Backend is down, not the session — keep the id for later and
            // let the unreachable screen offer a retry.
            setSessionId(stored)
            setFailed(true)
            return
          }
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }
      await start()
    } finally {
      setCreating(false)
    }
  }, [start])

  useEffect(() => {
    // Guard survives React 18 StrictMode's double effect invocation.
    if (bootstrapped.current) return
    bootstrapped.current = true
    void resolve()
  }, [resolve])

  const retry = useCallback(() => {
    void resolve()
  }, [resolve])

  const reset = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setSessionId(null)
    void start()
  }, [start])

  return { sessionId, creating, failed, start, retry, reset }
}
