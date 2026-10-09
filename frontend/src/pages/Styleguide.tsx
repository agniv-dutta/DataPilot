import { useState } from 'react'
import { CHART_PALETTE } from '../lib/constants'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { CodeBlock } from '../components/ui/CodeBlock'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { Tabs } from '../components/ui/Tabs'
import { Tooltip } from '../components/ui/Tooltip'
import { Markdown } from '../components/chat/Markdown'
import { ResultTable } from '../components/chat/ResultTable'
import { AnomalyList } from '../components/chat/AnomalyList'
import type { AnomalyReport, TableResult } from '../api/types'

const SAMPLE_TABLE: TableResult = {
  title: 'Revenue by region',
  columns: ['region', 'revenue', 'orders'],
  rows: [
    ['West', 128_450, 812],
    ['East', 96_120, 604],
    ['South', 62_400, 431],
    ['North', 48_900, 210],
  ],
  truncated: false,
}

const SAMPLE_ANOMALY: AnomalyReport = {
  dataset: 'sales',
  method: 'z-score + IQR',
  columns: ['revenue'],
  flagged_count: 2,
  total_count: 12,
  rows: [
    { row_index: 0, reasons: ['z-score = 4.2'], values: { date: '2023-03-15', revenue: 19_842 } },
    { row_index: 1, reasons: ['z-score = 3.7, outside IQR'], values: { date: '2023-07-02', revenue: 17_210 } },
  ],
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-extrabold text-navy">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-12 w-12 rounded-lg border border-borderline" style={{ background: value }} />
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  )
}

export function Styleguide() {
  const [modalOpen, setModalOpen] = useState(false)
  const pct = [20, 35, 60, 45, 80, 68, 55, 40, 72, 61, 49, 33]

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-extrabold text-navy">DataPilot — Styleguide</h1>
        <p className="text-xs text-muted">
          Design tokens, primitives, and chart conventions. Everything uses Tailwind theme values from
          <span className="font-mono"> tailwind.config.js</span>.
        </p>
      </header>

      <Section title="Color tokens">
        <div className="flex flex-wrap gap-4">
          <Swatch label="primary #2563EB" value="#2563EB" />
          <Swatch label="hover #1D4ED8" value="#1D4ED8" />
          <Swatch label="active #1E40AF" value="#1E40AF" />
          <Swatch label="navy #0B1F4B" value="#0B1F4B" />
          <Swatch label="sky accent #38BDF8" value="#38BDF8" />
          <Swatch label="app bg #F5F8FF" value="#F5F8FF" />
          <Swatch label="surface #FFFFFF" value="#FFFFFF" />
          <Swatch label="border #E3EAF8" value="#E3EAF8" />
          <Swatch label="muted #5B6B8C" value="#5B6B8C" />
          <Swatch label="danger #DC2626" value="#DC2626" />
        </div>
        <p className="mt-4 text-xs text-muted">
          Chart palette (8 blues): <span className="font-mono">{CHART_PALETTE.join(' · ')}</span>. Amber and
          red are reserved for anomalies and errors only.
        </p>
      </Section>

      <Section title="Buttons & badges">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
          <Badge tone="primary">primary</Badge>
          <Badge tone="success">success</Badge>
          <Badge tone="warning">warning</Badge>
          <Badge tone="danger">danger</Badge>
          <Badge tone="neutral">neutral</Badge>
          <Badge tone="info">info</Badge>
        </div>
      </Section>

      <Section title="Cards, tabs, tooltip, modal, skeleton">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Card component" subtitle="With title and subtitle" />
            <CardBody>
              <p className="text-xs text-muted">
                Cards use <span className="font-mono">@card</span> utility: rounded-card, border, surface bg,
                soft shadow.
              </p>
            </CardBody>
          </Card>
          <div className="space-y-2">
            <Tabs
              items={[
                { id: 'a', label: 'First', badge: 3, content: <p className="text-xs text-muted">Tab one.</p> },
                { id: 'b', label: 'Second', content: <p className="text-xs text-muted">Tab two.</p> },
              ]}
            />
            <div className="flex gap-2">
              <Tooltip label="Tooltip content">
                <button className="rounded-input border border-borderline px-3 py-1.5 text-xs text-navy">
                  Hover me
                </button>
              </Tooltip>
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            </div>
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </Section>

      <Section title="Markdown, code block, empty state">
        <div className="grid gap-4 lg:grid-cols-2">
          <Markdown
            content={[
              '# Heading',
              'Some **bold** and _italic_ with `inline code`.',
              '- bullet one',
              '- bullet two',
              '1. ordered',
              '2. list',
              '',
              '---',
              '> A neat quote.',
            ].join('\n')}
          />
          <div className="space-y-3">
            <CodeBlock code={'SELECT region, SUM(revenue) AS revenue\nFROM sales\nGROUP BY 1\nORDER BY 2 DESC LIMIT 5;'} language="sql" maxHeight="120px" />
            <EmptyState
              compact
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 17l4-5 4 2 5-6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
              title="Ask anything about your data"
              description="An empty beacon prompt."
            />
          </div>
        </div>
      </Section>

      <Section title="Result table & anomalies">
        <div className="space-y-4">
          <ResultTable table={SAMPLE_TABLE} />
          <AnomalyList report={SAMPLE_ANOMALY} />
        </div>
      </Section>

      <Section title="Chart micro-demo">
        <div className="flex items-end gap-1.5">
          {pct.map((h, i) => (
            <div
              key={i}
              className="w-8 rounded-t-md"
              style={{ height: `${h}px`, background: CHART_PALETTE[i % CHART_PALETTE.length] }}
              title={`${h}%`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Conventional look for charts — see ChartRenderer for full Recharts maps.</p>
      </Section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal demo">
        <p className="text-sm text-muted">
          Focus trapped, Escape closes, backdrop click closes. Used by PreviewModal for dataset previews.
        </p>
      </Modal>
    </div>
  )
}