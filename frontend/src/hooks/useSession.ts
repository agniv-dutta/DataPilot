import { useState } from 'react'
import { createSession } from '../api'
import { useToast } from './useToast'

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { show } = useToast()

  const start = async () => {
    setCreating(true)
    try {
      const session = await createSession()
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
  }

  const clear = () => setSessionId(null)

  return { sessionId, creating, start, clear }
}