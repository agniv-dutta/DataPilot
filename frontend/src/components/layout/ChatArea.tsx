import { useEffect, useRef, useState } from 'react'
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
  const { show } = useToast()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, events, streaming])

  const syncFallback = async (message: string): Promise<ChatEvent> => {
    const res = await chatSync(sessionId ?? '', message)
    const finalEvent: ChatFinalEvent = { type: 'final', final: res.final, iterations: res.iterations }
    return finalEvent
  }

  const sendMessage = (message: string) => {
    if (!sessionId || streaming) return
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
    if (final || errorEvent) {
      setStreaming(false)
      setPendingId(null)
      reset()
    }
  }, [events, pendingId, reset])

  useEffect(() => {
    if (error) {
      show({ tone: 'error', title: 'Stream interrupted', description: error })
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
        <div className="min-h-0 flex-1">
          <MessageList
            messages={messages as ChatMessage[]}
            onSuggestion={sendMessage}
            scrollRef={scrollRef}
            streamingId={streaming ? pendingId : null}
          />
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
