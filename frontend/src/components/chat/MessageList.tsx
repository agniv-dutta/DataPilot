import { useState } from 'react'
import type {
  ChatEvent,
  ChatFinalEvent,
  ChatStatusEvent,
  ChatToolCallEvent,
  FinalAnswer,
} from '../../api/types'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { ChevronDownIcon, SparkIcon } from '../ui/icons'
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

function ThinkingDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orchid opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-orchid" />
    </span>
  )
}

function StatusChip({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <ThinkingDot />
      {label}
    </div>
  )
}

function ToolChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-periwinkle/30 bg-periwinkle-soft px-2.5 py-1 text-[11px] font-medium text-ink/80">
      <Badge tone="periwinkle" className="border-0 px-1 py-0 text-[9px]">
        tool
      </Badge>
      {TOOL_LABELS[name] ?? name}
    </span>
  )
}

function Trace({
  events,
  streaming,
}: {
  events: ChatEvent[]
  streaming: boolean
}) {
  const [open, setOpen] = useState(false)
  const mechanics = events.filter(
    (e): e is ChatStatusEvent | ChatToolCallEvent => e.type === 'status' || e.type === 'tool_call',
  )
  if (mechanics.length === 0) {
    return streaming ? (
      <div className="mb-2">
        <StatusChip label="Thinking…" />
      </div>
    ) : null
  }

  const toolCount = mechanics.filter((m) => m.type === 'tool_call').length
  const show = streaming || open

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={streaming}
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-medium text-muted transition-colors',
          !streaming && 'hover:text-ink',
        )}
      >
        {streaming ? <ThinkingDot /> : <SparkIcon size={12} className="text-orchid" />}
        {streaming
          ? 'Working through your data…'
          : `Ran ${toolCount} step${toolCount === 1 ? '' : 's'}`}
        {!streaming && (
          <ChevronDownIcon size={12} className={cn('transition-transform', open && 'rotate-180')} />
        )}
      </button>
      {show && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mechanics.map((e, i) =>
            e.type === 'status' ? (
              <StatusChip key={i} label={e.message} />
            ) : (
              <ToolChip key={i} name={e.name} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function AssistantBody({
  events,
  streaming,
  onSuggestion,
  content,
}: {
  events: ChatEvent[]
  streaming: boolean
  onSuggestion: (q: string) => void
  content: string
}) {
  const finalEvent = events.find((e): e is ChatFinalEvent => e.type === 'final')
  return (
    <div>
      <Trace events={events} streaming={streaming} />
      {finalEvent ? (
        <FinalAnswerView final={finalEvent.final} onSuggestion={onSuggestion} />
      ) : content ? (
        <p className="text-sm leading-relaxed text-ink/90">{content}</p>
      ) : streaming ? (
        <div className="space-y-2 py-1">
          <div className="h-3 w-4/5 animate-pulse-soft rounded-pill bg-sunken" />
          <div className="h-3 w-3/5 animate-pulse-soft rounded-pill bg-sunken" />
        </div>
      ) : null}
    </div>
  )
}

export function MessageList({
  messages,
  onSuggestion,
  scrollRef,
  streamingId,
}: {
  messages: ChatMessage[]
  onSuggestion: (q: string) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  streamingId?: string | null
}) {
  return (
    <div
      ref={scrollRef as React.RefObject<HTMLDivElement>}
      className="flex flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6"
    >
      {messages.map((msg) =>
        msg.role === 'user' ? (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-hero px-4 py-2.5 text-sm font-medium text-canvas shadow-soft sm:max-w-[70%]">
              {msg.content}
            </div>
          </div>
        ) : (
          <div key={msg.id} className="flex justify-start">
            <div className="w-full max-w-[95%] animate-slide-up rounded-card border border-line bg-surface p-4 shadow-soft sm:max-w-[88%]">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-pill bg-hero text-canvas">
                  <SparkIcon size={11} />
                </span>
                <span className="font-display text-xs font-bold text-ink">DataPilot</span>
              </div>
              <AssistantBody
                events={msg.events ?? []}
                content={msg.content}
                streaming={msg.id === streamingId}
                onSuggestion={onSuggestion}
              />
            </div>
          </div>
        ),
      )}
    </div>
  )
}
