import type { DatasetInfo } from '../../api/types'
import { formatCompact } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

export function DatasetCard({
  dataset,
  onPreview,
  onRemove,
}: {
  dataset: DatasetInfo
  onPreview: (d: DatasetInfo) => void
  onRemove: (d: DatasetInfo) => void
}) {
  const { profile } = dataset
  const qualityTone =
    profile.quality_score >= 85 ? 'success' : profile.quality_score >= 60 ? 'warning' : 'danger'

  return (
    <div className="card p-3 transition-shadow hover:shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onPreview(dataset)} className="min-w-0 text-left">
          <span className="block truncate text-sm font-bold text-navy hover:text-primary">
            {dataset.filename}
          </span>
          <span className="block font-mono text-[11px] text-muted">{dataset.table_name}</span>
        </button>
        <Badge tone={qualityTone}>{profile.quality_score}</Badge>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-input bg-app py-1.5">
          <p className="text-sm font-bold text-navy">{formatCompact(profile.row_count)}</p>
          <p className="text-[10px] text-muted">rows</p>
        </div>
        <div className="rounded-input bg-app py-1.5">
          <p className="text-sm font-bold text-navy">{profile.column_count}</p>
          <p className="text-[10px] text-muted">cols</p>
        </div>
        <div className="rounded-input bg-app py-1.5">
          <p className="text-sm font-bold text-navy">{formatCompact(profile.columns.length)}</p>
          <p className="text-[10px] text-muted">fields</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <Button size="sm" variant="secondary" onClick={() => onPreview(dataset)}>
          Preview
        </Button>
        <button
          onClick={() => onRemove(dataset)}
          aria-label={`Remove ${dataset.filename}`}
          className="text-[11px] font-medium text-muted hover:text-danger"
        >
          Remove
        </button>
      </div>
    </div>
  )
}