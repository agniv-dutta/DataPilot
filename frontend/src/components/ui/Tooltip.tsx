import { cx } from '../../lib/utils'

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cx('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-input bg-navy px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}