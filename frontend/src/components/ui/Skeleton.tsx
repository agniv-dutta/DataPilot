import { cx } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx('animate-pulse-soft rounded-input bg-primary-100/70', className)}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="card p-4">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="mb-2 h-3 w-5/6" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}