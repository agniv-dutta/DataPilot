export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`flex ${compact ? 'px-4 py-6' : 'px-6 py-14'} flex-col items-center justify-center text-center`}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-bold text-navy">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  )
}