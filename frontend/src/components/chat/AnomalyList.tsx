import type { AnomalyDetail, AnomalyReport } from '../../api/types'
import { displayCell } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { AlertIcon } from '../ui/icons'

const BASIS_LABEL: Record<AnomalyDetail['basis'], string> = {
  iqr: 'IQR fences',
  zscore: 'mean ± 3σ',
}

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function RangeStrip({ detail }: { detail: AnomalyDetail }) {
  const { value, expected_low: lo, expected_high: hi } = detail
  if (value == null || lo == null || hi == null) return null

  // The band takes the middle third of the track; out-of-range values clamp
  // to the edge, which reads as "far outside" without breaking the scale.
  const width = hi - lo || Math.abs(hi) * 0.1 || 1
  const min = lo - width
  const max = hi + width
  const span = max - min || 1
  const pos = (x: number) => Math.min(100, Math.max(0, ((x - min) / span) * 100))
  const bandLeft = pos(lo)
  const bandWidth = Math.max(pos(hi) - bandLeft, 1.5)
  const outside = value < lo || value > hi
  const side = value > hi ? 'above' : value < lo ? 'below' : 'inside'

  return (
    <div className="rounded-input border border-ember/25 bg-sunken/60 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-ink">{detail.column}</span>
        <Badge tone="ember" className="px-1.5 py-0 text-[9px]">
          {BASIS_LABEL[detail.basis]}
        </Badge>
      </div>
      <div className="relative mt-2 h-2 rounded-pill bg-surface ring-1 ring-inset ring-line">
        <div
          className="absolute inset-y-0 rounded-pill bg-iris/30 ring-1 ring-inset ring-iris/50"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        <span
          aria-hidden
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-surface ${
            outside ? 'bg-ember shadow-soft' : 'bg-iris'
          }`}
          style={{ left: `${pos(value)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[10px]">
        <span className="font-mono text-muted">
          expected {num.format(lo)} – {num.format(hi)}
        </span>
        <span className={outside ? 'font-bold text-ember' : 'font-bold text-ink'}>
          {num.format(value)}
          {outside ? <span className="ml-1 font-medium text-muted">{side}</span> : null}
        </span>
      </div>
    </div>
  )
}

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
            {row.details && row.details.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {row.details.map((detail, i) => (
                  <RangeStrip key={`${detail.column}-${i}`} detail={detail} />
                ))}
              </div>
            )}
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
