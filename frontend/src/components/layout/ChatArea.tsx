import { useEffect, useMemo, useRef, useState } from 'react'
import { chatSync } from '../../api'
import type { ChatEvent, ChatFinalEvent } from '../../api/types'
import { useChatStream } from '../../hooks/useChatStream'
import { useToast } from '../../hooks/useToast'
import { uniqueId } from '../../lib/utils'
import { EmptyState } from '../ui/EmptyState'
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
  const { events, error, send, reset } = useChatStream(sessionId)
  const [messages, setMessages] = useState<CommittedMessage[]>([])
  const [streaming, setStreaming] = useState(false)
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
    if (!sessionId) return
    setMessages((prev) => [
      ...prev,
      { id: uniqueId('u'), role: 'user', content: message },
      { id: uniqueId('a'), role: 'assistant', content: '', events: [] },
    ])
    setStreaming(true)
    void send(message, () => syncFallback(message))
  }

  // Commit the assistant bubble when a final event arrives.
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    const final = events.find((e): e is ChatFinalEvent => e.type === 'final')
    const errorEvent = events.find((e) => e.type === 'error')

    if (final && lastAssistant && !lastAssistant.final) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === lastAssistant.id
            ? { ...m, final: final.final, events: [...(m.events ?? []), ...events.filter((e) => e.type !== 'chart' && e.type !== 'anomaly')] }
            : m,
        ),
      )
      setStreaming(false)
      reset()
    } else if (errorEvent && lastAssistant && !lastAssistant.final) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === lastAssistant.id
            ? { ...m, content: `⚠️ ${'error' in errorEvent ? errorEvent.message : 'Something went wrong.'}` }
            : m,
        ),
      )
      setStreaming(false)
      reset()
    }
  }, [events, messages, reset])

  useEffect(() => {
    if (error) {
      show({ tone: 'error', title: 'Stream interrupted', description: error })
      setStreaming(false)
    }
  }, [error, show])

  // The streaming mechanics (chips) shown in the in-flight bubble.
  const viewMessages: ChatMessage[] = useMemo(() => {
    const committed: ChatMessage[] = messages.map((m) => {
      if (m.role === 'user') return { id: m.id, role: 'user', content: m.content }
      return {
        id: m.id,
        role: 'assistant',
        content: m.content,
        final: m.final,
        events: m.final ? [...(m.events ?? [])] : [],
      }
    })

    if (streaming && !committed.some((m) => m.role === 'assistant' && m.final)) {
      committed.push({ id: 'live', role: 'assistant', content: '', events })
    }
    return committed
  }, [messages, streaming, events])

  const hasDatasets = Boolean(sessionId)
  const noConversation = messages.length === 0 && !streaming

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      {noConversation ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <EmptyState
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 17l4-5 4 2 5-6"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title={hasDatasets ? 'Ask anything about your data' : 'Welcome to DataPilot'}
            description={
              hasDatasets
                ? 'Start with one of the suggestions below or type your own question.'
                : 'Upload a CSV on the left — or load a sample dataset — then chat with your data.'
            }
          />
          {hasDatasets && (
            <SuggestionChips onPick={sendMessage} disabled={streaming} />
          )}
          <div className="mt-8 w-full max-w-2xl">
            <InputBox onSend={sendMessage} disabled={!hasDatasets || streaming} />
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <MessageList messages={viewMessages} onSuggestion={sendMessage} scrollRef={scrollRef} />
          </div>
          <InputBox onSend={sendMessage} disabled={!hasDatasets || streaming} />
        </>
      )}
    </main>
  )
}