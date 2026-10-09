import type { DatasetInfo } from '../../api/types'
import { APP_NAME } from '../../lib/constants'
import { Badge } from '../ui/Badge'
import { CardSkeleton } from '../ui/Skeleton'
import { DatasetCard } from '../datasets/DatasetCard'
import { UploadZone } from '../datasets/UploadZone'

export function Sidebar({
  visible,
  onClose,
  sessionId,
  creating,
  onStartSession,
  onClearSession,
  datasets,
  loading,
  onPreview,
  onRemove,
  onUploaded,
  onSample,
}: {
  visible: boolean
  onClose: () => void
  sessionId: string | null
  creating: boolean
  onStartSession: () => void
  onClearSession: () => void
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
          className="fixed inset-0 z-30 bg-navy-900/30 sm:hidden"
        />
      )}
      <aside
        aria-hidden={!visible}
        className={`fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-borderline bg-surface transition-transform sm:static sm:translate-x-0 ${
          visible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className="flex items-center gap-2.5 border-b border-borderline px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 17l4-5 4 2 5-6"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-extrabold text-navy">{APP_NAME}</h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">AI Data Analyst</p>
          </div>
          <button
            onClick={onClearSession}
            aria-label="Clear session"
            className="rounded-input text-muted hover:bg-primary-50 hover:text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 6h18M8 6V4h8v2m1 0-1 14H8L7 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
          <section aria-label="Datasets">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Datasets</h2>
              <Badge tone="primary">{datasets.length}</Badge>
            </div>
            {!sessionId ? (
              <div className="card flex flex-col items-center gap-3 p-4 text-center">
                <p className="text-xs text-muted">Start a session to upload data.</p>
                <button
                  onClick={onStartSession}
                  disabled={creating}
                  className="rounded-input bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-primary-hover disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Start session'}
                </button>
              </div>
            ) : (
              <>
                <UploadZone sessionId={sessionId} onUploaded={onUploaded} onSample={onSample} />
                <div className="mt-4 space-y-3">
                  {loading
                    ? [1, 2].map((i) => <CardSkeleton key={i} />)
                    : datasets.map((d) => (
                        <DatasetCard key={d.file_id} dataset={d} onPreview={onPreview} onRemove={onRemove} />
                      ))}
                  {!loading && datasets.length === 0 && (
                    <p className="rounded-input border border-dashed border-borderline p-3 text-center text-xs text-muted">
                      No datasets yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="border-t border-borderline px-4 py-3">
          <p className="text-[10px] leading-relaxed text-muted">
            Sandboxed execution: read-only DuckDB + AST-validated pandas. Everything runs
            on your data in memory.
          </p>
        </footer>
      </aside>
    </>
  )
}