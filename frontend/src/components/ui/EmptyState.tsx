import { cn } from '../../lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6' : 'px-6 py-14',
        className,
      )}
    >
      <div
        className={cn(
          'relative mb-4 flex items-center justify-center rounded-full bg-grad-soft',
          compact ? 'h-10 w-10' : 'h-14 w-14',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-0 animate-float rounded-full bg-grad-soft blur-md"
        />
        <span className="relative text-iris-active">
          {icon ?? <SparkPlaceholder size={compact ? 16 : 22} />}
        </span>
      </div>
      <h3 className="font-display text-sm font-bold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      ) : null}
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  )
}

function SparkPlaceholder({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v6M12 15v6M3 12h6M15 12h6"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  )
}
