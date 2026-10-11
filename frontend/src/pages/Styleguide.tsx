import { useState } from 'react'
import { CHART_PALETTE } from '../lib/constants'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button, IconButton } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { CodeBlock } from '../components/ui/CodeBlock'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Textarea } from '../components/ui/Input'
import { Kbd } from '../components/ui/Kbd'
import { Modal } from '../components/ui/Modal'
import { Progress, ScoreRing } from '../components/ui/Progress'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { StatCard } from '../components/ui/StatCard'
import { Switch } from '../components/ui/Switch'
import { Tabs } from '../components/ui/Tabs'
import { Tooltip } from '../components/ui/Tooltip'
import * as Icons from '../components/ui/icons'
import { ChartRenderer } from '../components/charts/ChartRenderer'
import { DatasetCard } from '../components/datasets/DatasetCard'
import { PreviewModal } from '../components/datasets/PreviewModal'
import { UploadZone } from '../components/datasets/UploadZone'
import { Markdown } from '../components/chat/Markdown'
import { ResultTable } from '../components/chat/ResultTable'
import { AnomalyList } from '../components/chat/AnomalyList'
import { FinalAnswerView } from '../components/chat/FinalAnswerView'
import { SuggestionChips } from '../components/chat/SuggestionChips'
import type { AnomalyReport, ChartSpec, DatasetInfo, FinalAnswer, TableResult } from '../api/types'

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
    {
      row_index: 0,
      reasons: ['revenue 4.2σ above mean of 8,410'],
      values: { date: '2023-03-15', revenue: 19_842 },
      details: [
        { column: 'revenue', value: 19_842, expected_low: 5_900, expected_high: 10_920, basis: 'zscore' },
      ],
    },
    {
      row_index: 1,
      reasons: ['revenue above the IQR fence (17,210 vs 14,120)'],
      values: { date: '2023-07-02', revenue: 17_210 },
      details: [
        { column: 'revenue', value: 17_210, expected_low: 1_240, expected_high: 14_120, basis: 'iqr' },
      ],
    },
  ],
}

const SAMPLE_CHART: ChartSpec = {
  chart_type: 'bar',
  title: 'Revenue by region',
  x: 'region',
  x_type: 'category',
  y_label: 'revenue (USD)',
  series: [{ name: 'revenue', data: [128_450, 96_120, 62_400, 48_900] }],
  data: [
    { region: 'West', revenue: 128_450 },
    { region: 'East', revenue: 96_120 },
    { region: 'South', revenue: 62_400 },
    { region: 'North', revenue: 48_900 },
  ],
}

const SAMPLE_DATASET: DatasetInfo = {
  file_id: 'demo-1',
  filename: 'sales.csv',
  table_name: 'sales',
  size_bytes: 1_240_000,
  uploaded_at: '2026-10-11T09:00:00Z',
  profile: {
    row_count: 2000,
    column_count: 3,
    columns: [
      { name: 'region', dtype: 'object', null_pct: 0, unique_count: 4, min: null, max: null, mean: null, top_values: [{ value: 'West', count: 512 }] },
      { name: 'revenue', dtype: 'float64', null_pct: 0.4, unique_count: 1876, min: 12, max: 19_842, mean: 418, top_values: [{ value: 320, count: 4 }] },
      { name: 'orders', dtype: 'int64', null_pct: 0, unique_count: 96, min: 1, max: 40, mean: 6, top_values: [{ value: 3, count: 210 }] },
    ],
    sample_rows: [
      { region: 'West', revenue: 128.45, orders: 3 },
      { region: 'East', revenue: 96.12, orders: 2 },
    ],
    quality_score: 92,
    quality_issues: ['2 nulls in revenue'],
  },
}

const ICON_LIST = (Object.entries(Icons) as Array<[string, React.ComponentType<{ size?: number }>]>).filter(
  ([name]) => name.endsWith('Icon'),
)

/** SQL-only final answer: proves the tab strip disappears for a lone part. */
const SAMPLE_FINAL: FinalAnswer = {
  answer:
    'The **West region** leads with $128,450 across 812 orders — about 38% of total revenue.',
  insights: ['West beats East by 34%', 'Highest average order value at $158'],
  sql: 'SELECT region, SUM(revenue) AS revenue\nFROM sales\nGROUP BY region\nORDER BY revenue DESC\nLIMIT 1;',
  pandas_code: null,
  charts: [],
  tables: [],
  anomalies: [],
  reasoning: [],
  follow_up_suggestions: ['Show the monthly revenue trend', 'Who are the top 5 customers?'],
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
      <h2 className="mb-4 font-display text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="h-14 w-14 rounded-card border border-line" style={{ background: value }} />
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  )
}

export function Styleguide() {
  const [modalOpen, setModalOpen] = useState(false)
  const [previewData, setPreviewData] = useState<DatasetInfo | null>(null)
  const [seg, setSeg] = useState('light')
  const [felt, setFelt] = useState(true)
  const [region, setRegion] = useState('west')
  const { theme, toggle } = useTheme()
  const { show } = useToast()
  const pct = [20, 35, 60, 45, 80, 68, 55, 40, 72, 61, 49, 33]

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-display-s text-ink">
              DataPilot <span className="accent-serif text-iris">Iris &amp; Ember</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              Design tokens, primitives, and chart conventions. Colors resolve from{' '}
              <span className="font-mono">styles/tokens.css</span> via{' '}
              <span className="font-mono">tailwind.config.ts</span>.
            </p>
          </div>
          <Tooltip label="Toggle light / dark">
            <IconButton aria-label="Toggle theme" onClick={toggle}>
              {theme === 'dark' ? <Icons.SunIcon size={16} /> : <Icons.MoonIcon size={16} />}
            </IconButton>
          </Tooltip>
        </header>

        <Section title="Type specimen">
          <div className="space-y-3">
            <p className="text-display-xl text-ink">Ask anything.</p>
            <p className="text-display-l text-ink">
              Your data, <span className="accent-serif text-orchid">illuminated</span>
            </p>
            <p className="text-display-m text-ink">Report headline</p>
            <p className="text-display-s text-ink">Section heading</p>
            <p className="text-sm text-ink">
              Body copy in Instrument Sans — the quick brown fox jumps over the lazy dog.
            </p>
            <p className="font-mono text-xs text-muted">SELECT region, SUM(revenue) FROM sales;</p>
            <p className="text-xs text-muted">
              Shortcut <Kbd>⌘</Kbd> <Kbd>K</Kbd> · <Kbd>⏎</Kbd>
            </p>
          </div>
        </Section>

        <Section title="Color tokens">
          <div className="flex flex-wrap gap-4">
            <Swatch label="canvas" value="rgb(var(--canvas-rgb))" />
            <Swatch label="surface" value="rgb(var(--surface-rgb))" />
            <Swatch label="sunken" value="rgb(var(--sunken-rgb))" />
            <Swatch label="ink" value="rgb(var(--ink-rgb))" />
            <Swatch label="muted" value="rgb(var(--muted-rgb))" />
            <Swatch label="iris" value="rgb(var(--iris-rgb))" />
            <Swatch label="ember" value="rgb(var(--ember-rgb))" />
            <Swatch label="orchid" value="rgb(var(--orchid-rgb))" />
            <Swatch label="periwinkle" value="rgb(var(--periwinkle-rgb))" />
            <Swatch label="berry" value="rgb(var(--berry-rgb))" />
            <Swatch label="leaf" value="rgb(var(--leaf-rgb))" />
          </div>
          <p className="mt-4 text-xs text-muted">
            Chart palette: <span className="font-mono">{CHART_PALETTE.join(' · ')}</span>. The hero gradient
            flows iris → orchid → ember. <span className="text-ember">Ember</span> marks anomalies,{' '}
            <span className="text-berry">berry</span> errors, <span className="text-leaf">leaf</span> success
            (check marks only).
          </p>
          <p className="mt-1 text-xs text-muted">
            Forbidden: pure white, pure black, teal, cyan, gold/yellow/amber.
          </p>
        </Section>

        <Section title="Buttons, badges & pills">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="soft">Soft</Button>
            <Button variant="ember">Ember</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button pill size="sm">
              Pill
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="iris">iris</Badge>
            <Badge tone="ember">ember / anomaly</Badge>
            <Badge tone="orchid">orchid</Badge>
            <Badge tone="periwinkle">periwinkle</Badge>
            <Badge tone="berry">berry / error</Badge>
            <Badge tone="leaf">leaf / success</Badge>
            <Badge tone="neutral">neutral</Badge>
          </div>
        </Section>

        <Section title="Cards, tabs, tooltip, modal, skeleton">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card gradient>
              <CardHeader title="Card component" subtitle="Optional gradient hairline" />
              <CardBody>
                <p className="text-xs text-muted">
                  Rounded-card, hairline border, layered iris-tinted shadow.
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
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip label="Tooltip content">
                  <span className="inline-flex">
                    <Button variant="outline" size="sm">
                      Hover me
                    </Button>
                  </span>
                </Tooltip>
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  Open modal
                </Button>
                <Progress value={64} className="w-32" />
                <ScoreRing value={92} size={48} />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Dataset name" placeholder="e.g. Q3 sales" hint="Used as the table name." />
            <Input label="With error" defaultValue="bad-value" error="Must be a number." />
            <Select
              ariaLabel="Region"
              value={region}
              onValueChange={setRegion}
              options={[
                { value: 'west', label: 'West' },
                { value: 'east', label: 'East' },
                { value: 'south', label: 'South' },
              ]}
            />
            <SegmentedControl
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
            <Switch checked={felt} onCheckedChange={setFelt} label="Reduce motion visuals" />
            <Textarea label="Notes" placeholder="Add context for the analyst…" rows={3} />
          </div>
        </Section>

        <Section title="Stat cards">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Revenue" value="$84.2k" delta={{ value: '+12.4%', positive: true }} spark={pct} />
            <StatCard label="Orders" value="4,812" delta={{ value: '-3.1%' }} spark={[...pct].reverse()} />
            <StatCard label="Rows scanned" value="2.0M" spark={pct.map((p) => p + 10)} />
          </div>
        </Section>

        <Section title="Markdown, code block, empty state">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="prose-answer">
              <Markdown
                content={[
                  '# Heading',
                  'Some **bold** and _italic_ with `inline code`.',
                  '- bullet one',
                  '- bullet two',
                  '',
                  '> A neat quote.',
                ].join('\n')}
              />
            </div>
            <div className="space-y-3">
              <CodeBlock
                code={'SELECT region, SUM(revenue) AS revenue\nFROM sales\nGROUP BY 1\nORDER BY 2 DESC LIMIT 5;'}
                language="sql"
                maxHeight="120px"
              />
              <EmptyState
                compact
                icon={<Icons.TrendIcon size={20} />}
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

        <Section title="Charts (Recharts)">
          <ChartRenderer spec={SAMPLE_CHART} />
          <p className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Chart palette
          </p>
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
          <p className="mt-2 text-[11px] text-muted">
            Toolbar: show/hide the data table, export CSV, export PNG. The table reuses the sortable,
            paginated ResultTable.
          </p>
        </Section>

        <Section title="Toast notifications">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => show({ tone: 'info', title: 'Dataset ready', description: 'sales.csv · 2,000 rows' })}
            >
              Info
            </Button>
            <Button
              variant="outline"
              onClick={() => show({ tone: 'success', title: 'Imported sales.csv' })}
            >
              Success
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                show({
                  tone: 'error',
                  title: 'Stream interrupted',
                  description: 'The backend closed the connection.',
                  action: {
                    label: 'Retry',
                    onClick: () => show({ tone: 'success', title: 'Reconnected', description: 'Retry worked.' }),
                  },
                })
              }
            >
              Error + Retry
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Fixed bottom-right, auto-dismiss after 6s, <span className="font-mono">role=&quot;alert&quot;</span>.
            Errors can carry a retry action used by chat, uploads and dataset refreshes.
          </p>
        </Section>

        <Section title="Avatars & icons">
          <div className="flex items-center gap-2">
            <Avatar name="Ada Analyst" />
            <Avatar name="Rev Ops" />
            <Avatar name="Q" />
            <Avatar name="" />
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
            {ICON_LIST.map(([name, Icon]) => (
              <span
                key={name}
                title={name}
                className="flex h-9 w-9 items-center justify-center rounded-input border border-line bg-sunken/60 text-muted"
              >
                <Icon size={16} />
              </span>
            ))}
          </div>
        </Section>

        <Section title="Final answer (tabs only with 2+ parts)">
          <FinalAnswerView final={SAMPLE_FINAL} onSuggestion={() => undefined} />
          <p className="mt-3 text-[11px] text-muted">
            One part (SQL) renders bare — no tab strip. Two or more parts (SQL + reasoning, charts,
            tables) switch to <span className="font-mono">&lt;Tabs&gt;</span> automatically, and
            follow-up chips appear whenever the backend suggests them.
          </p>
        </Section>

        <Section title="Suggestion chips">
          <SuggestionChips onPick={() => undefined} />
        </Section>

        <Section title="Datasets: card, upload, preview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <DatasetCard dataset={SAMPLE_DATASET} onPreview={setPreviewData} onRemove={() => undefined} />
              <UploadZone sessionId="demo" onUploaded={() => undefined} onSample={() => undefined} />
            </div>
            <div className="space-y-3">
              <p className="text-xs text-muted">
                The upload zone accepts drops and click-to-browse; sample buttons preload the bundled CSVs.
                The card opens the preview modal (profile table, sample rows, quality badges). In this demo
                the callbacks are stubbed, so uploads do not run.
              </p>
              <Button variant="soft" onClick={() => setPreviewData(SAMPLE_DATASET)}>
                Open preview modal
              </Button>
            </div>
          </div>
        </Section>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal demo">
          <p className="text-sm text-muted">
            Focus trapped, Escape closes, backdrop click closes. Used by PreviewModal for dataset previews.
          </p>
        </Modal>
        <PreviewModal dataset={previewData} onClose={() => setPreviewData(null)} />
      </div>
    </div>
  )
}
