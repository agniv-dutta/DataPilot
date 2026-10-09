import type { DatasetInfo } from '../../api/types'
import { formatCompact, formatBytes } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { CloseIcon, TableIcon } from '../ui/icons'

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
    profile.quality_score >= 85 ? 'leaf' : profile.quality_score >= 60 ? 'ember' : 'berry'

  return (
    <div className="group rounded-card border border-line bg-surface p-3 shadow-soft transition-all duration-150 ease-out-expo hover:-translate-y-0.5 hover:border-iris/30 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onPreview(dataset)} className="min-w-0 text-left">
          <span className="flex items-center gap-1.5 truncate text-sm font-bold text-ink transition-colors group-hover:text-iris-active">
            <TableIcon size={14} className="shrink-0 text-muted" />
            {dataset.filename}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">
            {dataset.table_name} · {formatBytes(dataset.size_bytes)}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={qualityTone}>{profile.quality_score}</Badge>
          <IconButton
            aria-label={`Remove ${dataset.filename}`}
            onClick={() => onRemove(dataset)}
            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <CloseIcon size={13} />
          </IconButton>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-input bg-sunken/60 py-1.5">
          <p className="text-sm font-bold text-ink">{formatCompact(profile.row_count)}</p>
          <p className="text-[10px] text-muted">rows</p>
        </div>
        <div className="rounded-input bg-sunken/60 py-1.5">
          <p className="text-sm font-bold text-ink">{profile.column_count}</p>
          <p className="text-[10px] text-muted">cols</p>
        </div>
        <div className="rounded-input bg-sunken/60 py-1.5">
          <p className="text-sm font-bold text-ink">{profile.quality_issues.length}</p>
          <p className="text-[10px] text-muted">issues</p>
        </div>
      </div>
      <Button size="sm" variant="soft" className="mt-2.5 w-full" onClick={() => onPreview(dataset)}>
        Preview
      </Button>
    </div>
  )
}
