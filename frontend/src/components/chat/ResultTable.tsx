import { useMemo, useState } from 'react'
import type { TableResult } from '../../api/types'
import { Badge } from '../ui/Badge'
import { displayCell } from '../../lib/utils'

const PAGE_SIZE = 20

export function ResultTable({ table }: { table: TableResult }) {
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    if (!sort) return table.rows
    const idx = table.columns.indexOf(sort.col)
    if (idx < 0) return table.rows
    const sorted = [...table.rows]
    sorted.sort((a, b) => {
      const av = a[idx]
      const bv = b[idx]
      const an = Number(av)
      const bn = Number(bv)
      if (Number.isFinite(an) && Number.isFinite(bn)) return an < bn ? -1 : an > bn ? 1 : 0
      return String(av).localeCompare(String(bv))
    })
    return sort.dir === 1 ? sorted : sorted.reverse()
  }, [table, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const clamped = Math.min(page, pages - 1)
  const pageRows = rows.slice(clamped * PAGE_SIZE, clamped * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (col: string) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: 1 }
      if (prev.dir === 1) return { col, dir: -1 }
      return null
    })
    setPage(0)
  }

  return (
    <div className="overflow-hidden rounded-card border border-borderline">
      <div className="flex items-center justify-between border-b border-borderline bg-app px-3 py-2">
        <span className="text-xs font-bold text-navy">{table.title}</span>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {table.truncated && <Badge tone="warning">truncated</Badge>}
          <span>{formatCount(rows.length)} rows</span>
        </div>
      </div>
      <div className="max-h-72 overflow-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {table.columns.map((col) => (
                <th key={col}>
                  <button
                    onClick={() => toggleSort(col)}
                    className="w-full px-3 py-1.5 text-left font-semibold text-muted hover:text-primary"
                    aria-label={`Sort by ${col}`}
                  >
                    {col}
                    {sort?.col === col ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-borderline first:border-t-0 odd:bg-app/40">
                {row.map((cell, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-1 text-navy/80">
                    {displayCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-borderline px-3 py-2 text-xs">
          <span className="text-muted">
            Page {clamped + 1} of {pages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={clamped === 0}
              onClick={() => setPage(clamped - 1)}
              className="rounded-input border border-borderline px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={clamped >= pages - 1}
              onClick={() => setPage(clamped + 1)}
              className="rounded-input border border-borderline px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}