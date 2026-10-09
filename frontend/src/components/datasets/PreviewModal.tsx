import type { DatasetInfo } from '../../api/types'
import { displayCell, formatBytes } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'

export function PreviewModal({ dataset, onClose }: { dataset: DatasetInfo | null; onClose: () => void }) {
  if (!dataset) return null
  const { profile } = dataset

  return (
    <Modal open title={dataset.filename} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="iris">{profile.row_count} rows</Badge>
          <Badge tone="periwinkle">{profile.column_count} columns</Badge>
          <Badge tone="neutral">{formatBytes(dataset.size_bytes)}</Badge>
          <Badge tone={profile.quality_score >= 85 ? 'leaf' : profile.quality_score >= 60 ? 'ember' : 'berry'}>
            quality {profile.quality_score}
          </Badge>
          {profile.quality_issues.map((issue) => (
            <Badge key={issue} tone="ember">
              {issue}
            </Badge>
          ))}
        </div>

        <div className="overflow-hidden rounded-input border border-line">
          <table className="w-full text-xs">
            <thead className="bg-sunken">
              <tr>
                {['column', 'dtype', 'null %', 'unique', 'min/max', 'top values'].map((h) => (
                  <th key={h} className="border-b border-line px-2 py-1.5 text-left font-semibold text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profile.columns.map((col) => (
                <tr key={col.name} className="border-b border-line last:border-0">
                  <td className="px-2 py-1 font-mono font-medium text-ink">{col.name}</td>
                  <td className="px-2 py-1 font-mono text-periwinkle">{col.dtype}</td>
                  <td className="px-2 py-1">{col.null_pct > 0 ? `${col.null_pct}%` : '—'}</td>
                  <td className="px-2 py-1">{col.unique_count}</td>
                  <td className="px-2 py-1">
                    {col.min !== null && col.min !== undefined ? (
                      <span>
                        {displayCell(col.min, 18)} → {displayCell(col.max, 18)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {col.top_values.slice(0, 5).map((tv, i) => (
                        <span
                          key={i}
                          className="rounded bg-sunken px-1 py-0.5 font-mono text-[10px] text-muted"
                        >
                          {displayCell(tv.value, 16)} ({tv.count})
                        </span>
                      ))}
                      {col.top_values.length === 0 ? '—' : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Sample rows</h4>
          <div className="overflow-x-auto rounded-input border border-line">
            <table className="w-full text-xs">
              <thead className="bg-sunken">
                <tr>
                  {profile.columns.map((c) => (
                    <th
                      key={c.name}
                      className="border-b border-line px-2 py-1.5 text-left font-mono font-semibold text-muted"
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.sample_rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {profile.columns.map((c) => (
                      <td key={c.name} className="px-2 py-1">
                        {displayCell(row[c.name], 40)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
