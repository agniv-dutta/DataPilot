import type { AnomalyReport } from '../../api/types'
import { displayCell } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { AlertIcon } from '../ui/icons'

export function AnomalyList({ report }: { report: AnomalyReport }) {
  return (
    <div className="rounded-card border border-ember/35 bg-ember-soft p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <AlertIcon size={15} className="text-ember" />
          {report.flagged_count} anomalies in &ldquo;{report.dataset}&rdquo;
        </h4>
        <Badge tone="ember">{report.method}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">
        {report.flagged_count} of {report.total_count} rows flagged.
      </p>
      <ul className="mt-3 space-y-2">
        {report.rows.map((row) => (
          <li key={row.row_index} className="rounded-input border border-ember/25 bg-surface p-2">
            <div className="flex items-start gap-2">
              <span className="rounded bg-ember-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ember">
                row {row.row_index}
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {row.reasons.map((reason, i) => (
                  <span key={i} className="text-xs text-ink/80">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
              {Object.entries(row.values)
                .slice(0, 6)
                .map(([k, v]) => (
                  <span key={k}>
                    <span className="font-semibold text-ink/70">{k}:</span> {displayCell(v, 24)}
                  </span>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
