import { cn } from '../../lib/utils'

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-line-strong',
        'bg-surface px-1.5 font-mono text-[10px] font-medium text-muted shadow-inset',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
