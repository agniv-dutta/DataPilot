import { navigate } from '../lib/router'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card, CardBody } from '../components/ui/Card'
import { Sparkline } from '../components/ui/StatCard'
import {
  AlertIcon,
  ArrowRightIcon,
  ChartIcon,
  CheckIcon,
  CloseIcon,
  DatabaseIcon,
  LayersIcon,
  ShieldIcon,
  SparkIcon,
  TrendIcon,
  UsersIcon,
} from '../components/ui/icons'
import { APP_NAME, SAMPLE_QUESTIONS } from '../lib/constants'

/* 1 — nav · 2 — hero · 3 — metrics · 4 — features · 5 — sample questions
   6 — sandbox · 7 — workflows · 8 — updates · 9 — CTA + footer */

const FEATURES = [
  {
    icon: DatabaseIcon,
    title: 'Ask in plain English',
    body: 'Under the hood it writes SQL and pandas, runs it against your file, and explains what it found.',
  },
  {
    icon: ChartIcon,
    title: 'Charts, not walls of text',
    body: 'Trends, breakdowns, distributions, and anomalies — rendered as clean, downloadable visuals.',
  },
  {
    icon: ShieldIcon,
    title: 'Sandboxed by design',
    body: 'Read-only DuckDB and AST-validated pandas with timeouts and row limits. Your data stays in memory.',
  },
] as const

const METRICS = [
  { value: '25 MB', label: 'per CSV upload', detail: 'checked at the door' },
  { value: '10 s', label: 'sandbox timeout', detail: 'on every SQL / pandas run' },
  { value: '10,000', label: 'rows per result', detail: 'then it truncates, loudly' },
  { value: '36 / 36', label: 'attack probes blocked', detail: 'SQL and pandas, verified' },
] as const

const BLOCKED = [
  'DROP TABLE',
  'DELETE FROM',
  'ATTACH',
  'COPY … TO',
  'read_csv_auto',
  'os.system',
  '__import__',
  'open()',
  'eval()',
] as const

const ALLOWED = ['SELECT …', 'GROUP BY', 'window functions', 'df.groupby()', 'pd.merge', 'boolean filters'] as const

const WORKFLOWS = [
  {
    icon: UsersIcon,
    role: 'Data analysts',
    title: 'Skip the boilerplate SQL',
    body: 'Describe the cut you need, get the query, the table, and a chart you can download — then keep iterating in plain English.',
    prompt: 'Join sales with customers and break revenue down by tier.',
  },
  {
    icon: TrendIcon,
    role: 'Finance & RevOps',
    title: 'Close the report faster',
    body: 'Monthly trends, averages and rankings come back grounded in the numbers, with the SQL attached for review.',
    prompt: 'What is the average order value by month?',
  },
  {
    icon: AlertIcon,
    role: 'Founders & PMs',
    title: 'Spot the outliers first',
    body: 'z-score, IQR and IsolationForest flag the rows that matter and show each value against its expected range.',
    prompt: 'Detect anomalies in revenue.',
  },
] as const

const UPDATES = [
  {
    date: 'Oct 2026',
    tag: 'Design',
    title: 'Iris & Ember',
    body: 'A complete token system in light and dark, plus a /styleguide that documents every primitive.',
  },
  {
    date: 'Oct 10, 2026',
    tag: 'Ops',
    title: 'One-command stack',
    body: 'docker compose up serves FastAPI behind nginx, with CI running lint, tests and the production build.',
  },
  {
    date: 'Oct 9, 2026',
    tag: 'Engine',
    title: 'Groq streaming',
    body: 'SSE answers with tool-call recovery and an 8k-token context budget that keeps long analyses in one request.',
  },
  {
    date: 'Oct 9, 2026',
    tag: 'Safety',
    title: 'Sandbox hardening',
    body: 'Read-only DuckDB, AST-validated pandas, 10s timeouts and hard row caps — 36 of 36 probes blocked.',
  },
] as const

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: React.ReactNode
  body?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-iris">{eyebrow}</p>
      <h2 className="text-display-m mt-3 text-balance">{title}</h2>
      {body ? <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p> : null}
    </div>
  )
}

export function Landing() {
  const go = () => navigate('/app')

  return (
    <div className="grain relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 animate-aurora rounded-full bg-grad-soft blur-3xl"
      />

      {/* 1 — nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-input bg-hero text-canvas shadow-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 17l4.5-6 3.5 2 5-7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-display text-base font-bold">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-1 text-xs">
          <button
            onClick={() => navigate('/styleguide')}
            className="rounded-pill px-3 py-1.5 font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Styleguide
          </button>
          <Button size="sm" pill onClick={go}>
            Open app
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        {/* 2 — hero */}
        <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
          <Badge tone="iris" className="mb-5">
            <SparkIcon size={12} /> AI data analyst for spreadsheets
          </Badge>
          <h1 className="text-display-xl max-w-4xl text-balance">
            Ask your spreadsheets <span className="accent-serif text-orchid">anything</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
            Upload a CSV and chat with your data. {APP_NAME} plans the analysis, writes the SQL,
            draws the charts, and flags the outliers — all inside a sandbox.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" pill onClick={go}>
              Start analyzing <ArrowRightIcon size={16} />
            </Button>
            <Button size="lg" pill variant="outline" onClick={() => navigate('/styleguide')}>
              See the design system
            </Button>
          </div>
        </section>

        {/* 3 — key metrics */}
        <section aria-label="Key limits and guarantees" className="mt-14">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-soft sm:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="bg-surface px-5 py-6 text-center">
                <p className="font-display text-2xl font-bold tracking-tight text-ink">{m.value}</p>
                <p className="mt-1 text-xs font-semibold text-ink/80">{m.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{m.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4 — features */}
        <section className="mt-16">
          <SectionHeading
            eyebrow="What it does"
            title="Three things, done properly"
            body="Chat over your tables, get visuals you can act on, and keep the whole thing inside a sandbox."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="grain" gradient>
                <CardBody>
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-input bg-iris-soft text-iris-active">
                    <f.icon size={18} />
                  </span>
                  <h3 className="font-display text-sm font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{f.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* 5 — sample questions + product showcase */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="Try one"
            title="Questions the sample data already answers"
            body="Six plain-English prompts, run against the bundled sales, customers and products CSVs. Pick one and the app opens with it ready to send."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {SAMPLE_QUESTIONS.slice(0, 6).map((q, i) => (
              <button
                key={q}
                onClick={go}
                className="group flex items-start gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-iris/40 hover:shadow-lift"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-iris-soft font-display text-[11px] font-bold text-iris-active">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug text-ink">{q}</span>
                  <span className="mt-1 block text-[11px] font-medium text-muted transition-colors group-hover:text-iris">
                    Open in the app →
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <Card className="overflow-hidden p-0" gradient>
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-ember/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-orchid/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-periwinkle/60" />
                <span className="ml-2 font-mono text-[11px] text-muted">datapilot — chat</span>
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                <div className="space-y-3 p-5">
                  <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-hero px-3.5 py-2 text-xs font-medium text-canvas">
                    Which region generated the highest revenue?
                  </div>
                  <div className="rounded-card border border-line bg-surface p-3 shadow-soft">
                    <p className="text-xs text-ink/90">
                      The <strong>West</strong> region leads with{' '}
                      <strong>$128,450</strong> across 812 orders — about 38% of total revenue.
                    </p>
                    <div className="mt-3 rounded-input border border-iris/20 bg-iris-soft p-2.5">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                        <span>revenue by region</span>
                        <span className="font-mono">$336,470</span>
                      </div>
                      <Sparkline points={[48, 62, 55, 80, 74, 96, 88, 128]} color="rgb(var(--iris-rgb))" />
                    </div>
                  </div>
                </div>
                <div className="hidden flex-col justify-center gap-4 border-l border-line bg-sunken/40 p-5 sm:flex">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Inspector</p>
                  <div className="rounded-card border border-line bg-surface p-3">
                    <p className="font-mono text-xs font-bold">sales</p>
                    <p className="mt-1 text-[11px] text-muted">2,000 rows · 9 cols · quality 99.8</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-sunken">
                      <div className="h-full w-[99%] rounded-pill bg-leaf" />
                    </div>
                  </div>
                  <div className="rounded-card border border-line bg-surface p-3">
                    <p className="font-mono text-[11px] text-muted">SELECT region, SUM(revenue)…</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* 6 — sandbox & security */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="Sandbox & security"
            title="Generated code never runs unsandboxed"
            body="Every SQL statement is parsed and must be a single SELECT. Every pandas snippet is walked as an AST before a line of it executes."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card className="grain">
              <CardBody>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-input bg-iris-soft text-iris-active">
                    <ShieldIcon size={17} />
                  </span>
                  <h3 className="font-display text-sm font-bold">Four layers of defence</h3>
                </div>
                <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-muted">
                  <li className="flex gap-2.5">
                    <CheckIcon size={14} className="mt-0.5 shrink-0 text-leaf" />
                    <span>
                      <strong className="text-ink">Read-only DuckDB.</strong> Only SELECT or WITH
                      survives validation — DDL, DML, PRAGMA, ATTACH and file readers are rejected.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckIcon size={14} className="mt-0.5 shrink-0 text-leaf" />
                    <span>
                      <strong className="text-ink">AST-validated pandas.</strong> Imports, dunders,
                      <code className="rounded bg-sunken px-1"> open()</code>, eval and subprocess
                      never reach the interpreter.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckIcon size={14} className="mt-0.5 shrink-0 text-leaf" />
                    <span>
                      <strong className="text-ink">Timeouts and caps.</strong> 10s per run, 10,000
                      rows per result, tables held in memory for the session only.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckIcon size={14} className="mt-0.5 shrink-0 text-leaf" />
                    <span>
                      <strong className="text-ink">Bounded context.</strong> Tool output handed to
                      the model is row-capped and clipped, so long analyses stay inside one request.
                    </span>
                  </li>
                </ul>
              </CardBody>
            </Card>

            <Card className="grain">
              <CardBody>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-input bg-berry-soft text-berry">
                    <CloseIcon size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold">What the sandbox refuses</h3>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {BLOCKED.map((b) => (
                    <span
                      key={b}
                      className="rounded-pill border border-berry/30 bg-berry-soft px-2.5 py-1 font-mono text-[11px] text-berry"
                    >
                      {b}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-input bg-leaf/15 text-leaf">
                    <CheckIcon size={16} />
                  </span>
                  <h3 className="font-display text-sm font-bold">And what it runs happily</h3>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {ALLOWED.map((a) => (
                    <span
                      key={a}
                      className="rounded-pill border border-leaf/30 bg-leaf/10 px-2.5 py-1 font-mono text-[11px] text-leaf"
                    >
                      {a}
                    </span>
                  ))}
                </div>
                <p className="mt-5 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
                  Your CSVs stay in memory on the machine running {APP_NAME}; only the schema and
                  the rows your query returns are shared with the model.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* 7 — workflows by role */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="Who it is for"
            title="Three ways people open it every week"
            body="Same sandbox, same sample data — a different starting question depending on the seat you sit in."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {WORKFLOWS.map((w) => (
              <Card key={w.role} className="grain flex flex-col">
                <CardBody className="flex flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-input bg-periwinkle-soft text-iris-active">
                      <w.icon size={18} />
                    </span>
                    <Badge tone="periwinkle">{w.role}</Badge>
                  </div>
                  <h3 className="mt-3 font-display text-sm font-bold">{w.title}</h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">{w.body}</p>
                  <button
                    onClick={go}
                    className="mt-4 w-full rounded-input border border-line bg-sunken/60 p-2.5 text-left font-mono text-[11px] leading-snug text-ink/80 transition-colors hover:border-iris/40 hover:text-ink"
                  >
                    “{w.prompt}”
                  </button>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* 8 — updates / changelog */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="What's new"
            title="Shipped recently"
            body="The short version of the last few days of work on the engine, the sandbox and the interface."
          />
          <div className="mx-auto mt-8 max-w-3xl">
            <ol className="relative border-l border-line pl-6">
              {UPDATES.map((u, i) => (
                <li key={u.title} className={i === UPDATES.length - 1 ? 'relative pb-0' : 'relative pb-7'}>
                  <span
                    aria-hidden
                    className="absolute -left-[31px] top-1 h-3 w-3 rounded-pill border-2 border-canvas bg-iris"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="iris">{u.tag}</Badge>
                    <span className="font-mono text-[11px] text-muted">{u.date}</span>
                  </div>
                  <h3 className="mt-1.5 font-display text-sm font-bold">{u.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{u.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 9 — final CTA */}
        <section className="mt-20">
          <div className="relative overflow-hidden rounded-frame bg-hero px-6 py-12 text-center shadow-lift sm:px-10">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-grad-soft opacity-30" />
            <div className="relative">
              <LayersIcon size={26} className="mx-auto text-canvas/90" />
              <h2 className="text-display-m mx-auto mt-4 max-w-2xl text-balance text-canvas">
                Point it at a CSV and start asking
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-canvas/80">
                No account, no upload queue — the sample data is already loaded. Drop your own file
                in whenever you are ready.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" pill variant="ember" onClick={go}>
                  Start analyzing <ArrowRightIcon size={16} />
                </Button>
                <Button
                  size="lg"
                  pill
                  variant="outline"
                  className="border-canvas/40 bg-canvas/10 text-canvas hover:bg-canvas/20"
                  onClick={() => navigate('/styleguide')}
                >
                  Browse the styleguide
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9b — footer */}
      <footer className="relative z-10 border-t border-line px-6 py-6 text-center text-[11px] text-muted">
        {APP_NAME} · sandboxed analytics · local-first · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
