import type { ChartSpec, DataQualityReport } from '../../api/types'
import { formatCompact } from '../../lib/utils'
import { useInspector } from '../../hooks/useInspector'
import { LazyChartRenderer } from '../charts/LazyChartRenderer'
import { Button } from '../ui/Button'
import { CodeBlock } from '../ui/CodeBlock'
import { EmptyState } from '../ui/EmptyState'
import { Badge } from '../ui/Badge'
import { ScoreRing } from '../ui/Progress'
import { Skeleton } from '../ui/Skeleton'
import { Tabs } from '../ui/Tabs'
import { AlertIcon, ChartIcon, DatabaseIcon, CloseIcon, RefreshIcon, SqlIcon } from '../ui/icons'

function QualityCard({ q }: { q: DataQualityReport }) {
  const issues = [
    q.duplicate_rows > 0 && `${formatCompact(q.duplicate_rows)} duplicate rows`,
    q.constant_columns.length > 0 && `constant: ${q.constant_columns.join(', ')}`,
    ...Object.entries(q.outliers)
      .slice(0, 3)
      .map(([col, n]) => `${n} outliers · ${col}`),
    ...q.type_mismatches.slice(0, 2),
    ...Object.entries(q.nulls)
      .filter(([, pct]) => pct > 30)
      .slice(0, 3)
      .map(([col, pct]) => `${col}: ${pct}% missing`),
  ].filter(Boolean) as string[]

  return (
    <div className="rounded-card border border-line bg-surface p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold text-ink">{q.dataset}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {formatCompact(q.row_count)} rows · {formatCompact(q.column_count)} cols
          </p>
        </div>
        <ScoreRing value={q.score} size={44} />
      </div>
      {issues.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {issues.slice(0, 5).map((issue) => (
            <li key={issue} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-1 w-1 shrink-0 rounded-full bg-ember" />
              {issue}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-leaf">No issues detected.</p>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-3 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-11 w-11 rounded-full" />
          </div>
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-4/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartSkeletons() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-3 shadow-soft">
          <Skeleton className="h-3 w-32" />
          <div className="mt-3 flex h-28 items-end gap-2">
            <Skeleton className="h-[62%] w-full rounded-t-input" />
            <Skeleton className="h-[88%] w-full rounded-t-input" />
            <Skeleton className="h-[44%] w-full rounded-t-input" />
            <Skeleton className="h-[74%] w-full rounded-t-input" />
            <Skeleton className="h-[56%] w-full rounded-t-input" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HistorySkeletons() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-input border border-line bg-surface p-3">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-2.5 h-2.5 w-full" />
          <Skeleton className="mt-1.5 h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  )
}

function InspectorError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      compact
      icon={<AlertIcon size={18} />}
      title="Inspector unavailable"
      description={
        error instanceof Error ? error.message : 'The backend did not respond. Is it running?'
      }
      actions={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshIcon size={13} className="mr-1.5" />
          Retry
        </Button>
      }
    />
  )
}

function NoSessionYet() {
  return (
    <EmptyState
      compact
      icon={<DatabaseIcon size={18} />}
      title="No session yet"
      description="A session is created automatically — quality metrics appear here as soon as one is ready."
    />
  )
}

function Overview({ sessionId }: { sessionId: string | null }) {
  const { data, isLoading, isError, error, refetch } = useInspector(sessionId)
  if (!sessionId) return <NoSessionYet />
  if (isLoading) return <OverviewSkeleton />
  if (isError) return <InspectorError error={error} onRetry={() => void refetch()} />
  if (!data || data.quality.length === 0) {
    return (
      <EmptyState
        compact
        icon={<DatabaseIcon size={18} />}
        title="Nothing to inspect yet"
        description="Add a dataset and ask a question — quality metrics appear here."
      />
    )
  }
  return (
    <div className="space-y-3">
      {data.quality.map((q) => (
        <QualityCard key={q.dataset} q={q} />
      ))}
    </div>
  )
}

function PinnedCharts({ sessionId }: { sessionId: string | null }) {
  const { data, isLoading, isError, error, refetch } = useInspector(sessionId)
  if (!sessionId) return <NoSessionYet />
  if (isLoading) return <ChartSkeletons />
  if (isError) return <InspectorError error={error} onRetry={() => void refetch()} />
  if (!data || data.pinned_charts.length === 0) {
    return (
      <EmptyState
        compact
        icon={<ChartIcon size={18} />}
        title="No pinned charts"
        description="Charts you generate in chat are collected here."
      />
    )
  }
  return (
    <div className="space-y-3">
      {data.pinned_charts.slice(0, 4).map((chart: ChartSpec, i) => (
        <LazyChartRenderer key={`${chart.title}-${i}`} spec={chart} />
      ))}
    </div>
  )
}

function QueryHistory({ sessionId }: { sessionId: string | null }) {
  const { data, isLoading, isError, error, refetch } = useInspector(sessionId)
  if (!sessionId) return <NoSessionYet />
  if (isLoading) return <HistorySkeletons />
  if (isError) return <InspectorError error={error} onRetry={() => void refetch()} />
  if (!data || data.query_history.length === 0) {
    return (
      <EmptyState
        compact
        icon={<SqlIcon size={18} />}
        title="No queries yet"
        description="SQL run on your behalf will be listed here for review."
      />
    )
  }
  return (
    <div className="space-y-2">
      {data.query_history.slice(0, 8).map((q) => (
        <CodeBlock
          key={q.at}
          code={q.sql}
          language="sql"
          title={`${q.elapsed_ms}ms · ${q.rows} rows`}
          maxHeight="110px"
        />
      ))}
    </div>
  )
}

export function Inspector({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string | null
  open: boolean
  onClose: () => void
}) {
  return (
    <>
      {open && (
        <button
          aria-label="Close inspector"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-scrim/30 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-line bg-surface/85 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <header className="flex items-center justify-between px-4 py-3">
          <h2 className="font-display text-sm font-bold text-ink">Inspector</h2>
          <div className="flex items-center gap-1.5">
            <Badge tone="orchid">live</Badge>
            <button
              onClick={onClose}
              aria-label="Hide inspector"
              className="flex h-7 w-7 items-center justify-center rounded-input text-muted hover:bg-sunken hover:text-ink lg:hidden"
            >
              <CloseIcon size={15} />
            </button>
          </div>
        </header>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
          <Tabs
            items={[
              { id: 'overview', label: 'Overview', content: <Overview sessionId={sessionId} /> },
              { id: 'charts', label: 'Charts', content: <PinnedCharts sessionId={sessionId} /> },
              { id: 'history', label: 'History', content: <QueryHistory sessionId={sessionId} /> },
            ]}
          />
        </div>
      </aside>
    </>
  )
}
