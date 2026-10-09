import type { ChatEvent, ChatFinalEvent, FinalAnswer, ChatStatusEvent, ChatToolCallEvent } from '../../api/types'
import { cx } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { FinalAnswerView } from './FinalAnswerView'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  final?: FinalAnswer
  events?: ChatEvent[]
}

const TOOL_LABELS: Record<string, string> = {
  get_schema: 'Reading schema',
  run_sql: 'Running SQL',
  run_pandas: 'Executing pandas',
  create_chart: 'Building chart',
  detect_anomalies: 'Detecting anomalies',
  data_quality_report: 'Checking data quality',
}

function StatusChip({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      {label}
    </div>
  )
}

function ToolChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
      <Badge tone="primary" className="border-0 px-1 py-0 text-[9px]">
        tool
      </Badge>
      {TOOL_LABELS[name] ?? name}
    </span>
  )
}

function AssistantBody({ events, onSuggestion }: { events: ChatEvent[]; onSuggestion: (q: string) => void }) {
  const finalEvent = events.find((e) => e.type === 'final') as ChatFinalEvent | undefined
  const mechanics = events.filter(
    (e): e is ChatStatusEvent | ChatToolCallEvent => e.type === 'status' || e.type === 'tool_call',
  )

  return (
    <div className="space-y-2">
      {mechanics.slice(0, 12).map((e, i) =>
        e.type === 'status' ? (
          <StatusChip key={i} label={e.message} />
        ) : (
          <ToolChip key={i} name={e.name} />
        ),
      )}
      {finalEvent ? (
        <FinalAnswerView final={finalEvent.final} onSuggestion={onSuggestion} />
      ) : (
        <StatusChip label="Thinking…" />
      )}
    </div>
  )
}

export function MessageList({
  messages,
  onSuggestion,
  scrollRef,
}: {
  messages: ChatMessage[]
  onSuggestion: (q: string) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div ref={scrollRef as React.RefObject<HTMLDivElement>} className="flex flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
      {messages.map((msg) =>
        msg.role === 'user' ? (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-white shadow-soft sm:max-w-[70%]">
              {msg.content}
            </div>
          </div>
        ) : (
          <div key={msg.id} className="flex justify-start">
            <div
              className={cx(
                'w-full max-w-[92%] animate-slide-up rounded-2xl rounded-bl-sm border border-borderline bg-surface p-4 shadow-softer sm:max-w-[85%]',
              )}
            >
              <AssistantBody events={msg.events ?? []} onSuggestion={onSuggestion} />
            </div>
          </div>
        ),
      )}
    </div>
  )
}