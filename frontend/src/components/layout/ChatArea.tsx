import { useCallback, useEffect, useRef, useState } from 'react'
import { chatSync } from '../../api'
import type { ChatEvent, ChatFinalEvent } from '../../api/types'
import { useChatStream } from '../../hooks/useChatStream'
import { useToast } from '../../hooks/useToast'
import { uniqueId } from '../../lib/utils'
import { EmptyState } from '../ui/EmptyState'
import { SparkIcon } from '../ui/icons'
import { InputBox } from '../chat/InputBox'
import type { ChatMessage } from '../chat/MessageList'
import { MessageList } from '../chat/MessageList'
import { SuggestionChips } from '../chat/SuggestionChips'

interface CommittedMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  final?: import('../../api/types').FinalAnswer
  events?: ChatEvent[]
}

export function ChatArea({ sessionId }: { sessionId: string | null }) {
  const { events, error, send, reset, stop } = useChatStream(sessionId)
  const [messages, setMessages] = useState<CommittedMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pinnedRef = useRef(true)
  const retryRef = useRef<() => void>(() => undefined)
  // Smooth scrolling fires intermediate scroll events with the list far from
  // the bottom; ignore those so programmatic follow never unpins itself.
  // The window ends on `scrollend` (animation truly finished) with a timeout
  // fallback for browsers without it, then re-syncs pin state to the position
  // actually reached.
  const followingRef = useRef(false)
  const followTimer = useRef<number | null>(null)
  const [pinned, setPinned] = useState(true)
  const { show } = useToast()

  const endFollow = useCallback(() => {
    followingRef.current = false
    if (followTimer.current !== null) {
      window.clearTimeout(followTimer.current)
      followTimer.current = null
    }
    const el = scrollRef.current
    if (el) {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 64
      pinnedRef.current = near
      setPinned(near)
    }
  }, [])

  const followDown = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    followingRef.current = true
    if (followTimer.current !== null) window.clearTimeout(followTimer.current)
    followTimer.current = window.setTimeout(endFollow, 1200)
    el.addEventListener('scrollend', () => endFollow(), { once: true })
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [endFollow])

  const handleScroll = () => {
    if (followingRef.current) return
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 64
    pinnedRef.current = near
    setPinned(near)
  }

  const jumpToLatest = () => {
    pinnedRef.current = true
    setPinned(true)
    followDown()
  }

  useEffect(() => {
    if (!pinnedRef.current) return
    followDown()
  }, [messages, events, streaming, followDown])

  const syncFallback = async (message: string): Promise<ChatEvent> => {
    const res = await chatSync(sessionId ?? '', message)
    const finalEvent: ChatFinalEvent = { type: 'final', final: res.final, iterations: res.iterations }
    return finalEvent
  }

  const sendMessage = (message: string) => {
    if (!sessionId || streaming) return
    pinnedRef.current = true
    setPinned(true)
    const uid = uniqueId('u')
    const aid = uniqueId('a')
    setMessages((prev) => [
      ...prev,
      { id: uid, role: 'user', content: message },
      { id: aid, role: 'assistant', content: '', events: [] },
    ])
    setPendingId(aid)
    setStreaming(true)
    void send(message, () => syncFallback(message))
  }

  // Re-send the last prompt after dropping its failed reply, so retry never
  // duplicates the user's bubble. Kept in a ref so error effects can call the
  // latest closure without re-firing toasts.
  const retryLast = () => {
    if (!sessionId || streaming) return
    const last = messages[messages.length - 1]
    const user = messages[messages.length - 2]
    if (last?.role !== 'assistant' || last.final || user?.role !== 'user') return
    setMessages((prev) => {
      const next = [...prev]
      if (next[next.length - 1]?.id === last.id) next.pop()
      if (next[next.length - 1]?.id === user.id) next.pop()
      return next
    })
    sendMessage(user.content)
  }
  retryRef.current = retryLast

  // Fold streamed events into the pending assistant message.
  useEffect(() => {
    if (!pendingId) return
    const final = events.find((e): e is ChatFinalEvent => e.type === 'final')
    const errorEvent = events.find((e) => e.type === 'error')
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingId
          ? {
              ...m,
              events: events.filter((e) => e.type !== 'chart' && e.type !== 'anomaly'),
              ...(final ? { final: final.final } : {}),
              ...(errorEvent && 'message' in errorEvent ? { content: errorEvent.message } : {}),
            }
          : m,
      ),
    )
    if (errorEvent && !final && 'message' in errorEvent) {
      show({
        tone: 'error',
        title: 'Could not answer that',
        description: errorEvent.message,
        action: { label: 'Retry', onClick: () => retryRef.current() },
      })
    }
    if (final || errorEvent) {
      setStreaming(false)
      setPendingId(null)
      reset()
    }
  }, [events, pendingId, reset, show])

  useEffect(() => {
    if (error) {
      show({
        tone: 'error',
        title: 'Stream interrupted',
        description: error,
        action: { label: 'Retry', onClick: () => retryRef.current() },
      })
      setStreaming(false)
      setPendingId(null)
    }
  }, [error, show])

  const handleStop = () => {
    stop()
    setStreaming(false)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingId && !m.final ? { ...m, content: 'Stopped. Ask a follow-up whenever you are ready.' } : m,
      ),
    )
    setPendingId(null)
  }

  const hasDatasets = Boolean(sessionId)
  const noConversation = messages.length === 0 && !streaming

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col">
      {noConversation ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-aurora bg-grad-soft opacity-70 blur-3xl"
          />
          <div className="relative flex flex-col items-center text-center">
            <EmptyState
              icon={<SparkIcon size={22} />}
              title={hasDatasets ? 'Ask anything about your data' : 'Preparing your workspace'}
              description={
                hasDatasets
                  ? 'Start with one of the suggestions below, or type your own question.'
                  : 'Upload a CSV or load a sample dataset, then chat with your data.'
              }
            />
          </div>
          {hasDatasets && <SuggestionChips onPick={sendMessage} disabled={streaming} />}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <MessageList
            messages={messages as ChatMessage[]}
            onSuggestion={sendMessage}
            scrollRef={scrollRef}
            onScroll={handleScroll}
            streamingId={streaming ? pendingId : null}
          />
          {!pinned && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-pill border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-soft transition-colors hover:bg-sunken"
            >
              ↓ Latest
            </button>
          )}
        </div>
      )}
      <InputBox
        onSend={sendMessage}
        onStop={handleStop}
        streaming={streaming}
        disabled={!hasDatasets}
        autoFocus={!noConversation}
      />
    </main>
  )
}
