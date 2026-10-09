import { cn } from '../../lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const width = 100 / options.length

  return (
    <div
      role="radiogroup"
      className={cn('relative inline-grid rounded-pill border border-line bg-sunken p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 rounded-pill bg-surface shadow-soft transition-transform duration-250 ease-out-expo"
        style={{ width: `calc(${width}% - 2px)`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 rounded-pill px-3 font-medium transition-colors focus-visible:outline-none',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-xs',
            o.value === value ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
