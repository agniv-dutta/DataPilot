import type { DatasetInfo } from '../../api/types'
import { APP_NAME, APP_TAGLINE } from '../../lib/constants'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CardSkeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { DatabaseIcon, PlusIcon, ShieldIcon } from '../ui/icons'
import { DatasetCard } from '../datasets/DatasetCard'
import { UploadZone } from '../datasets/UploadZone'

export function Sidebar({
  visible,
  onClose,
  sessionId,
  creating,
  onNewSession,
  datasets,
  loading,
  onPreview,
  onRemove,
  onSample,
}: {
  visible: boolean
  onClose: () => void
  sessionId: string | null
  creating: boolean
  onNewSession: () => void
  datasets: DatasetInfo[]
  loading: boolean
  onPreview: (d: DatasetInfo) => void
  onRemove: (d: DatasetInfo) => void
  onUploaded: (datasets: DatasetInfo[]) => void
  onSample: (name: string) => void
}) {
  return (
    <>
      {visible && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        aria-hidden={!visible}
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col rounded-r-frame border-r border-line bg-surface/85 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 lg:rounded-none ${
          visible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-input bg-hero text-canvas shadow-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 17l4.5-6 3.5 2 5-7"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-sm font-bold text-ink">{APP_NAME}</h1>
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted">
              {APP_TAGLINE}
            </p>
          </div>
        </header>

        <div className="px-4 pb-3">
          <Button
            variant="soft"
            size="sm"
            pill
            className="w-full"
            onClick={onNewSession}
            loading={creating}
          >
            <PlusIcon size={14} />
            New session
          </Button>
        </div>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <section aria-label="Datasets">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Datasets</h2>
              <Badge tone="iris">{datasets.length}</Badge>
            </div>
            {!sessionId ? (
              <div className="space-y-3">
                <CardSkeleton />
                <p className="text-center text-[11px] text-muted">Preparing your workspace…</p>
              </div>
            ) : (
              <>
                <UploadZone sessionId={sessionId} onUploaded={() => undefined} onSample={onSample} />
                <div className="mt-4 space-y-3">
                  {loading
                    ? [1, 2].map((i) => <CardSkeleton key={i} />)
                    : datasets.map((d) => (
                        <DatasetCard
                          key={d.file_id}
                          dataset={d}
                          onPreview={onPreview}
                          onRemove={onRemove}
                        />
                      ))}
                  {!loading && datasets.length === 0 && (
                    <EmptyState
                      compact
                      icon={<DatabaseIcon size={18} />}
                      title="No datasets yet"
                      description="Upload a CSV or load a sample to begin."
                    />
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="border-t border-line px-4 py-3">
          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
            <ShieldIcon size={13} className="mt-0.5 shrink-0 text-leaf" />
            Sandboxed execution: read-only DuckDB + AST-validated pandas, in-memory on your data.
          </p>
        </footer>
      </aside>
    </>
  )
}
