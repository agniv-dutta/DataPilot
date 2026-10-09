import type { AnomalyReport } from '../../api/types'
import { displayCell } from '../../lib/utils'
import { Badge } from '../ui/Badge'

export function AnomalyList({ report }: { report: AnomalyReport }) {
  return (
    <div className="rounded-card border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-amber-800">
          ⚠ {report.flagged_count} anomalies in “{report.dataset}”
        </h4>
        <Badge tone="warning">{report.method}</Badge>
      </div>
      <p className="mt-1 text-xs text-amber-700/80">
        {report.flagged_count} of {report.total_count} rows flagged.
      </p>
      <ul className="mt-3 space-y-2">
        {report.rows.map((row) => (
          <li key={row.row_index} className="rounded-input border border-amber-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800">
                row {row.row_index}
              </span>
              <div className="flex flex-wrap gap-1">
                {row.reasons.map((reason, i) => (
                  <span key={i} className="text-xs text-amber-900">
                    • {reason}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
              {Object.entries(row.values)
                .slice(0, 6)
                .map(([k, v]) => (
                  <span key={k}>
                    <span className="font-semibold text-navy/70">{k}:</span> {displayCell(v, 24)}
                  </span>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}