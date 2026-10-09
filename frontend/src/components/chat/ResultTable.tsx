import { useMemo, useState } from 'react'
import type { TableResult } from '../../api/types'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/Button'
import { TableIcon } from '../ui/icons'
import { displayCell, downloadText } from '../../lib/utils'

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

  const exportCsv = () => {
    const header = table.columns.join(',')
    const body = rows
      .map((r) =>
        r
          .map((c) => {
            const s = c === null || c === undefined ? '' : String(c)
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(','),
      )
      .join('\n')
    downloadText(`${table.title.replace(/\s+/g, '_').toLowerCase()}.csv`, `${header}\n${body}`, 'text/csv')
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-sunken px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <TableIcon size={14} className="text-muted" />
          {table.title}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {table.truncated ? <Badge tone="ember">truncated</Badge> : null}
          <span>{new Intl.NumberFormat('en-US').format(rows.length)} rows</span>
          <IconButton aria-label="Export CSV" onClick={exportCsv} className="h-6 w-6">
            <span aria-hidden className="text-xs">
              &darr;
            </span>
          </IconButton>
        </div>
      </div>
      <div className="scrollbar-thin max-h-72 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {table.columns.map((col) => (
                <th key={col}>
                  <button
                    onClick={() => toggleSort(col)}
                    className="w-full px-3 py-1.5 text-left font-semibold text-muted transition-colors hover:text-iris-active"
                    aria-label={`Sort by ${col}`}
                  >
                    {col}
                    {sort?.col === col ? (sort.dir === 1 ? ' \u2191' : ' \u2193') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-t border-line odd:bg-sunken/40">
                {row.map((cell, j) => (
                  <td key={j} className="whitespace-nowrap px-3 py-1 text-ink/85">
                    {displayCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
          <span className="text-muted">
            Page {clamped + 1} of {pages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={clamped === 0}
              onClick={() => setPage(clamped - 1)}
              className="rounded-input border border-line-strong px-2 py-1 transition-colors hover:bg-sunken disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={clamped >= pages - 1}
              onClick={() => setPage(clamped + 1)}
              className="rounded-input border border-line-strong px-2 py-1 transition-colors hover:bg-sunken disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
