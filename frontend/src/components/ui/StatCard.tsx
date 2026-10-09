import { cn } from '../../lib/utils'

export function Sparkline({
  points,
  color = 'rgb(var(--iris-rgb))',
  className,
}: {
  points: number[]
  color?: string
  className?: string
}) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const w = 100
  const h = 28
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / span) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCard({
  label,
  value,
  delta,
  spark,
  className,
}: {
  label: string
  value: React.ReactNode
  delta?: { value: string; positive?: boolean }
  spark?: number[]
  className?: string
}) {
  return (
    <div className={cn('rounded-card border border-line bg-surface p-3.5 shadow-soft', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="font-display text-xl font-bold text-ink">{value}</span>
        {delta ? (
          <span
            className={cn(
              'rounded-pill px-1.5 py-0.5 text-[10px] font-bold',
              delta.positive ? 'bg-leaf-soft text-leaf' : 'bg-ember-soft text-ember',
            )}
          >
            {delta.value}
          </span>
        ) : null}
      </div>
      {spark ? <Sparkline points={spark} className="mt-2" /> : null}
    </div>
  )
}
