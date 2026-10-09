import { Suspense, lazy } from 'react'
import type { ChartSpec } from '../../api/types'
import { Skeleton } from '../ui/Skeleton'

// Recharts + html-to-image are heavy; load them only when a chart is shown.
const ChartRendererImpl = lazy(() =>
  import('./ChartRenderer').then((m) => ({ default: m.ChartRenderer })),
)

function ChartFallback() {
  return (
    <div className="rounded-card border border-line bg-surface p-3.5 shadow-soft">
      <Skeleton className="mb-2 h-4 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function LazyChartRenderer({ spec }: { spec: ChartSpec }) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <ChartRendererImpl spec={spec} />
    </Suspense>
  )
}
