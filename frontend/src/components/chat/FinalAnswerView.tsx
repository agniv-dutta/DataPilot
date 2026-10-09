import type { FinalAnswer } from '../../api/types'
import { ChartRenderer } from '../charts/ChartRenderer'
import { CodeBlock } from '../ui/CodeBlock'
import { Tabs } from '../ui/Tabs'
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
  const hasCode = Boolean(final.sql || final.pandas_code)
  const hasReasoning = final.reasoning.length > 0
  const hasParts = hasCode || hasReasoning || final.charts.length || final.tables.length

  return (
    <div className="space-y-3">
      <Markdown content={final.answer} />

      {final.insights.length > 0 && (
        <ul className="space-y-1 rounded-input border border-primary-100 bg-primary-50/50 p-3 text-xs text-primary-800">
          {final.insights.map((insight, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden>✦</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      )}

      {final.charts.map((chart, i) => (
        <ChartRenderer key={`chart-${i}`} spec={chart} />
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
                            <span className="font-medium text-navy">Step {i + 1}.</span> {step}
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
              className="rounded-full border border-primary/30 bg-surface px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}