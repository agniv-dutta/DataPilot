import { useRef } from 'react'
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
import { CHART_PALETTE } from '../../lib/constants'
import { useToast } from '../../hooks/useToast'

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

function ChartInner({ spec, data }: { spec: ChartSpec; data: Array<Record<string, unknown>> }) {
  const names = spec.series.map((s) => s.name)
  const common = {
    data,
    margin: { top: 8, right: 12, left: -12, bottom: 4 },
  }

  switch (spec.chart_type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" />
            <XAxis dataKey={spec.x} tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <YAxis tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <Tooltip cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
            <Legend />
            {names.map((name, i) => (
              <Bar key={name} name={name} dataKey={name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[4, 4, 0, 0]} />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" />
            <XAxis dataKey={spec.x} tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <YAxis tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <Tooltip />
            <Legend />
            {names.map((name, i) =>
              spec.chart_type === 'area' ? (
                <Area
                  key={name}
                  type="monotone"
                  name={name}
                  dataKey={name}
                  stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                  fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              ) : (
                <Line
                  key={name}
                  type="monotone"
                  name={name}
                  dataKey={name}
                  stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                  strokeWidth={2}
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
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="78%" paddingAngle={2}>
              {pieData.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" />
            <XAxis dataKey="x" name={spec.x} tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <YAxis dataKey="y" name={name} tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name={name} data={scatterData} fill={CHART_PALETTE[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      )
    }
    case 'histogram':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E3EAF8" />
            <XAxis dataKey={spec.x} tick={{ fontSize: 9, fill: '#5B6B8C' }} />
            <YAxis tick={{ fontSize: 11, fill: '#5B6B8C' }} />
            <Tooltip />
            {names.map((name, i) => (
              <Bar key={name} name={name} dataKey={name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[3, 3, 0, 0]} />
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

export function ChartRenderer({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null)
  const { show } = useToast()
  const data = toChartData(spec)

  const download = async () => {
    if (!ref.current) return
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const a = document.createElement('a')
      a.href = url
      a.download = `${spec.title.replace(/\s+/g, '_').toLowerCase()}.png`
      a.click()
    } catch {
      show({ tone: 'error', title: 'Export failed', description: 'Could not render the PNG.' })
    }
  }

  const titleId = `chart-${spec.title.toLowerCase().replace(/\W+/g, '-')}`

  return (
    <div className="chart-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 id={titleId} className="text-sm font-bold text-navy">
          {spec.title}
        </h4>
        <button
          onClick={download}
          aria-label={`Download ${spec.title} as PNG`}
          className="rounded-input border border-borderline px-2 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary"
        >
          <span aria-hidden>⬇</span> PNG
        </button>
      </div>
      <div ref={ref} role="img" aria-labelledby={titleId} className="h-64 w-full">
        <ChartInner spec={spec} data={data} />
      </div>
    </div>
  )
}