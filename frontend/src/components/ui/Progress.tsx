import { cn } from '../../lib/utils'

export function Progress({
  value,
  className,
  tone = 'iris',
}: {
  value: number
  className?: string
  tone?: 'iris' | 'ember' | 'orchid'
}) {
  const pct = Math.max(0, Math.min(100, value))
  const bg = tone === 'ember' ? 'bg-ember' : tone === 'orchid' ? 'bg-orchid' : 'bg-iris'
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-pill bg-sunken', className)}
    >
      <div
        className={cn('h-full rounded-pill transition-[width] duration-400 ease-out-expo', bg)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const stroke = pct >= 85 ? 'rgb(var(--leaf-rgb))' : pct >= 60 ? 'rgb(var(--ember-rgb))' : 'rgb(var(--berry-rgb))'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-sunken" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          stroke={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-400 ease-out-expo"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-ink">
        {Math.round(pct)}
      </span>
    </div>
  )
}
