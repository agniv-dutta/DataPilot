import { cn } from '../../lib/utils'

export function Avatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-pill bg-hero font-display text-xs font-bold text-canvas',
        'h-8 w-8',
        className,
      )}
      aria-hidden
    >
      {initials || 'DP'}
    </span>
  )
}
