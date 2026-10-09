import type { FinalAnswer } from '../../api/types'
import { LazyChartRenderer } from '../charts/LazyChartRenderer'
import { CodeBlock } from '../ui/CodeBlock'
import { Tabs } from '../ui/Tabs'
import { SparkIcon } from '../ui/icons'
import { AnomalyList } from './AnomalyList'
import { Markdown } from './Markdown'
import { ResultTable } from './ResultTable'

export function FinalAnswerView({
  final,
  onSuggestion,
}: {
  final: FinalAnswer
  onSuggestion?: (q: string) => void
}) {
  const hasReasoning = final.reasoning.length > 0
  const hasParts = Boolean(final.sql) || Boolean(final.pandas_code) || hasReasoning

  return (
    <div className="space-y-3">
      <Markdown content={final.answer} />

      {final.insights.length > 0 && (
        <ul className="space-y-1.5 rounded-input border border-iris/20 bg-iris-soft p-3 text-xs text-ink/90">
          {final.insights.map((insight, i) => (
            <li key={i} className="flex gap-2">
              <SparkIcon size={13} className="mt-0.5 shrink-0 text-orchid" />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      )}

      {final.charts.map((chart, i) => (
        <LazyChartRenderer key={`chart-${i}`} spec={chart} />
      ))}

      {final.tables.map((table, i) => (
        <ResultTable key={`table-${i}`} table={table} />
      ))}

      {final.anomalies.map((report, i) => (
        <AnomalyList key={`anomaly-${i}`} report={report} />
      ))}

      {hasParts && (
        <Tabs
          items={[
            ...(final.sql
              ? [{ id: 'sql', label: 'SQL', content: <CodeBlock code={final.sql} language="sql" title="SQL" /> }]
              : []),
            ...(final.pandas_code
              ? [
                  {
                    id: 'pandas',
                    label: 'Pandas',
                    content: <CodeBlock code={final.pandas_code} language="python" title="Pandas" />,
                  },
                ]
              : []),
            ...(hasReasoning
              ? [
                  {
                    id: 'reasoning',
                    label: 'Reasoning',
                    content: (
                      <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted">
                        {final.reasoning.map((step, i) => (
                          <li key={i}>
                            <span className="font-medium text-ink">Step {i + 1}.</span> {step}
                          </li>
                        ))}
                      </ol>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {final.follow_up_suggestions.length > 0 && onSuggestion && (
        <div className="flex flex-wrap gap-2 pt-1">
          {final.follow_up_suggestions.map((q) => (
            <button
              key={q}
              onClick={() => onSuggestion(q)}
              className="rounded-pill border border-iris/25 bg-surface px-3 py-1 text-xs font-medium text-iris-active transition-colors hover:border-iris/50 hover:bg-iris-soft"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
