import { navigate } from '../lib/router'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Card, CardBody } from '../components/ui/Card'
import { Sparkline } from '../components/ui/StatCard'
import { ArrowRightIcon, ChartIcon, DatabaseIcon, ShieldIcon, SparkIcon } from '../components/ui/icons'
import { APP_NAME } from '../lib/constants'

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

export function Landing() {
  const go = () => navigate('/app')

  return (
    <div className="grain relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 animate-aurora rounded-full bg-grad-soft blur-3xl"
      />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-input bg-hero text-canvas shadow-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 17l4.5-6 3.5 2 5-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-display text-base font-bold">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-1 text-xs">
          <button onClick={() => navigate('/styleguide')} className="rounded-pill px-3 py-1.5 font-medium text-muted transition-colors hover:bg-sunken hover:text-ink">
            Styleguide
          </button>
          <Button size="sm" pill onClick={go}>
            Open app
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
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

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
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
        </section>

        <section className="mt-14">
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
        </section>
      </main>

      <footer className="relative z-10 border-t border-line px-6 py-6 text-center text-[11px] text-muted">
        {APP_NAME} · sandboxed analytics · local-first
      </footer>
    </div>
  )
}
