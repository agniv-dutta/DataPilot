import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toPng } from 'html-to-image'
import type { ChartSpec } from '../../api/types'
import { cn, downloadText, formatCompact, getChartPalette } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import { ResultTable } from '../chat/ResultTable'
import { IconButton } from '../ui/Button'
import { Tooltip as UiTooltip } from '../ui/Tooltip'
import { DownloadIcon, FileIcon, TableIcon } from '../ui/icons'

function useChartTheme() {
  const [palette, setPalette] = useState<string[]>(() => getChartPalette())
  useEffect(() => {
    const refresh = () => setPalette(getChartPalette())
    const mo = new MutationObserver(refresh)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] })
    refresh()
    return () => mo.disconnect()
  }, [])
  return palette
}

function toChartData(spec: ChartSpec): Array<Record<string, unknown>> {
  if (spec.data && spec.data.length > 0) return spec.data
  const rows: Array<Record<string, unknown>> = []
  const names = spec.series.map((s) => s.name)
  const maxLen = Math.max(...spec.series.map((s) => s.data.length), 1)
  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, unknown> = { [spec.x]: spec.series[0]?.data[i] ?? null }
    for (const s of spec.series) row[s.name] = s.data[i]
    if (names.length > 1 && spec.series[0]) {
      row[spec.x] = i
    }
    rows.push(row)
  }
  return rows
}

const AXIS = 'rgb(var(--muted-rgb))'
const GRID = 'rgb(var(--line-rgb) / 0.14)'
// Compact ticks keep 8-digit revenue axes from clipping off the card.
const compactTick = (v: unknown) => (typeof v === 'number' ? formatCompact(v) : String(v))

function tooltipStyles() {
  return {
    contentStyle: {
      background: 'rgb(var(--surface-rgb))',
      border: '1px solid rgb(var(--line-rgb) / 0.18)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-1)',
      fontSize: 12,
      color: 'rgb(var(--ink-rgb))',
    },
    labelStyle: { color: 'rgb(var(--muted-rgb))', fontWeight: 600 },
    itemStyle: { color: 'rgb(var(--ink-rgb))' },
  }
}

function ChartInner({
  spec,
  data,
  palette,
}: {
  spec: ChartSpec
  data: Array<Record<string, unknown>>
  palette: string[]
}) {
  const names = spec.series.map((s) => s.name)
  const common = { data, margin: { top: 8, right: 12, left: -12, bottom: 4 } }
  const tt = tooltipStyles()

  switch (spec.chart_type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey={spec.x} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={compactTick} />
            <Tooltip cursor={{ fill: 'rgb(var(--iris-rgb) / 0.06)' }} {...tt} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {names.map((name, i) => (
              <Bar
                key={name}
                name={name}
                dataKey={name}
                fill={palette[i % palette.length]}
                radius={[5, 5, 0, 0]}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    case 'line':
    case 'area': {
      const Chart = spec.chart_type === 'area' ? AreaChart : LineChart
      return (
        <ResponsiveContainer width="100%" height="100%">
          <Chart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey={spec.x} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={compactTick} />
            <Tooltip {...tt} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {names.map((name, i) =>
              spec.chart_type === 'area' ? (
                <Area
                  key={name}
                  type="monotone"
                  name={name}
                  dataKey={name}
                  stroke={palette[i % palette.length]}
                  fill={palette[i % palette.length]}
                  fillOpacity={0.16}
                  strokeWidth={2}
                  animationDuration={600}
                />
              ) : (
                <Line
                  key={name}
                  type="monotone"
                  name={name}
                  dataKey={name}
                  stroke={palette[i % palette.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  animationDuration={600}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      )
    }
    case 'pie': {
      const pieData = data.map((row, i) => ({
        name: String(row.name ?? row[spec.x] ?? i),
        value: Number(row.value ?? spec.series[0]?.data[i] ?? 0),
      }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="78%"
              paddingAngle={2}
              animationDuration={600}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} stroke="rgb(var(--surface-rgb))" />
              ))}
            </Pie>
            <Tooltip {...tt} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    case 'scatter': {
      const name = names[0] ?? spec.series[0]?.name ?? 'value'
      const scatterData = data.map((row) => ({
        x: numberOr(row[spec.x]),
        y: numberOr(row[name]),
        name: String(row[spec.x]),
      }))
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="x" name={spec.x} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis dataKey="y" name={name} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={compactTick} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} {...tt} />
            <Scatter name={name} data={scatterData} fill={palette[0]} animationDuration={600} />
          </ScatterChart>
        </ResponsiveContainer>
      )
    }
    case 'histogram':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey={spec.x} tick={{ fontSize: 9, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={compactTick} />
            <Tooltip cursor={{ fill: 'rgb(var(--iris-rgb) / 0.06)' }} {...tt} />
            {names.map((name, i) => (
              <Bar
                key={name}
                name={name}
                dataKey={name}
                fill={palette[i % palette.length]}
                radius={[3, 3, 0, 0]}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    default:
      return null
  }
}

function numberOr(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function chartTable(spec: ChartSpec, data: Array<Record<string, unknown>>) {
  const names = spec.series.map((s) => s.name)
  if (spec.chart_type === 'pie') {
    const columns = ['name', 'value']
    const rows = data.map((row, i) => [
      String(row.name ?? row[spec.x] ?? i),
      numberOr(row.value ?? spec.series[0]?.data[i]),
    ])
    return { title: `${spec.title} · data`, columns, rows, truncated: false }
  }
  const columns = [spec.x, ...names]
  const rows = data.map((row) => [row[spec.x], ...names.map((n) => row[n])])
  return { title: `${spec.title} · data`, columns, rows, truncated: false }
}

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null)
  const { show } = useToast()
  const palette = useChartTheme()
  const data = toChartData(spec)
  const [showData, setShowData] = useState(false)
  const table = useMemo(() => chartTable(spec, data), [spec, data])

  const download = async () => {
    if (!ref.current) return
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface-rgb').trim()
      const url = await toPng(ref.current, {
        pixelRatio: 2,
        backgroundColor: bg ? `rgb(${bg})` : 'rgb(var(--surface-rgb))',
      })
      const a = document.createElement('a')
      a.href = url
      a.download = `${spec.title.replace(/\s+/g, '_').toLowerCase()}.png`
      a.click()
    } catch {
      show({ tone: 'error', title: 'Export failed', description: 'Could not render the PNG.' })
    }
  }

  const downloadCsv = () => {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [table.columns.map(escape).join(','), ...table.rows.map((r) => r.map(escape).join(','))].join('\n')
    downloadText(`${spec.title.replace(/\s+/g, '_').toLowerCase()}.csv`, csv, 'text/csv')
  }

  const titleId = `chart-${spec.title.toLowerCase().replace(/\W+/g, '-')}`

  return (
    <div className="rounded-card border border-line bg-surface p-3.5 shadow-soft">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id={titleId} className="font-display text-sm font-bold text-ink">
            {spec.title}
          </h4>
          {spec.y_label ? <p className="mt-0.5 text-[11px] text-muted">{spec.y_label}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <UiTooltip label={showData ? 'Hide data table' : 'Show data table'}>
            <IconButton
              aria-label={showData ? 'Hide chart data table' : 'Show chart data table'}
              aria-pressed={showData}
              onClick={() => setShowData((v) => !v)}
              className={cn('h-7 w-7', showData && 'bg-iris-soft text-iris-active')}
            >
              <TableIcon size={14} />
            </IconButton>
          </UiTooltip>
          <UiTooltip label="Download data as CSV">
            <IconButton aria-label={`Download ${spec.title} data as CSV`} onClick={downloadCsv} className="h-7 w-7">
              <FileIcon size={14} />
            </IconButton>
          </UiTooltip>
          <UiTooltip label="Download as PNG">
            <IconButton aria-label={`Download ${spec.title} as PNG`} onClick={download} className="h-7 w-7">
              <DownloadIcon size={14} />
            </IconButton>
          </UiTooltip>
        </div>
      </div>
      <div ref={ref} role="img" aria-labelledby={titleId} className="h-64 w-full bg-surface">
        <ChartInner spec={spec} data={data} palette={palette} />
      </div>
      {showData && (
        <div className="mt-3 border-t border-line pt-3">
          <ResultTable table={table} />
        </div>
      )}
    </div>
  )
}
