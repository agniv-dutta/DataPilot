import type { ChartSpec } from '../../api/types'
import { formatCompact } from '../../lib/utils'
import { useInspector } from '../../hooks/useInspector'
import { ChartRenderer } from '../charts/ChartRenderer'
import { CodeBlock } from '../ui/CodeBlock'
import { Skeleton } from '../ui/Skeleton'
import { Tabs } from '../ui/Tabs'

function QualitySummary({ sessionId }: { sessionId: string | null }) {
  const { data, isLoading } = useInspector(sessionId)

  if (isLoading || !sessionId) return <Skeleton className="h-32 w-full" />
  if (!data || data.quality.length === 0)
    return <p className="py-4 text-center text-xs text-muted">No datasets to inspect.</p>

  return (
    <div className="space-y-3">
      {data.quality.map((q) => (
        <div key={q.dataset} className="rounded-input border border-borderline p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-navy">{q.dataset}</span>
            <span
              className={
                q.score >= 85
                  ? 'text-xs font-bold text-emerald-600'
                  : q.score >= 60
                    ? 'text-xs font-bold text-amber-600'
                    : 'text-xs font-bold text-red-600'
              }
            >
              {q.score}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(q.score, 2)}%` }}
            />
          </div>
          <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
            <li>• {formatCompact(q.row_count)} rows, {formatCompact(q.column_count)} columns</li>
            {q.duplicate_rows > 0 && <li>• {formatCompact(q.duplicate_rows)} duplicate rows</li>}
            {q.constant_columns.length > 0 && (
              <li>• constant columns: {q.constant_columns.join(', ')}</li>
            )}
            {Object.entries(q.outliers).slice(0, 3).map(([col, n]) => (
              <li key={col}>
                • {n} outliers in {col}
              </li>
            ))}
            {q.type_mismatches.slice(0, 2).map((m) => (
              <li key={m}>• {m}</li>
            ))}
            {Object.entries(q.nulls)
              .filter(([, pct]) => pct > 30)
              .slice(0, 3)
              .map(([col, pct]) => (
                <li key={col}>• {col}: {pct}% missing</li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function Inspector({ sessionId, open, onClose }: { sessionId: string | null; open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <button
          aria-label="Close inspector"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-navy-900/30 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-borderline bg-surface transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <header className="flex items-center justify-between border-b border-borderline px-4 py-3">
          <h2 className="text-sm font-bold text-navy">Inspector</h2>
          <button
            onClick={onClose}
            aria-label="Hide inspector"
            className="rounded-input text-muted hover:bg-primary-50 hover:text-primary lg:hidden"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <PinnedCharts sessionId={sessionId} />
          <QueryHistory sessionId={sessionId} />
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Data quality</h3>
            <QualitySummary sessionId={sessionId} />
          </div>
        </div>
      </aside>
    </>
  )
}

function PinnedCharts({ sessionId }: { sessionId: string | null }) {
  const { data, isLoading } = useInspector(sessionId)
  if (isLoading || !data) return <Skeleton className="mb-4 h-24 w-full" />
  if (data.pinned_charts.length === 0) return null
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Pinned charts</h3>
      <div className="space-y-2">
        {data.pinned_charts.slice(0, 3).map((chart: ChartSpec) => (
          <ChartRenderer key={chart.title + data.pinned_charts.indexOf(chart)} spec={chart} />
        ))}
      </div>
    </div>
  )
}

function QueryHistory({ sessionId }: { sessionId: string | null }) {
  const { data, isLoading } = useInspector(sessionId)
  if (isLoading || !data) return null
  if (data.query_history.length === 0) return null

  return (
    <div className="mb-4">
      <Tabs
        items={[
          {
            id: 'queries',
            label: 'Query history',
            badge: data.query_history.length,
            content: (
              <div className="space-y-2">
                {data.query_history.slice(0, 5).map((q) => (
                  <div key={q.at}>
                    <CodeBlock
                      code={q.sql}
                      language="sql"
                      title={`${q.elapsed_ms}ms · ${q.rows} rows`}
                      maxHeight="96px"
                    />
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}