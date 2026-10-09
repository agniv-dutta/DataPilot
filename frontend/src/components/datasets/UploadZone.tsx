import { useRef, useState } from 'react'
import { uploadFiles } from '../../api'
import type { DatasetInfo } from '../../api/types'
import { SAMPLE_DATASETS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import { Progress } from '../ui/Progress'
import { ArrowRightIcon, UploadIcon } from '../ui/icons'

interface UploadProgress {
  name: string
  percent: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

export function UploadZone({
  sessionId,
  onUploaded,
  onSample,
}: {
  sessionId: string | null
  onUploaded: (datasets: DatasetInfo[]) => void
  onSample: (name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const { show } = useToast()

  const handleFiles = async (files: File[]) => {
    if (!sessionId || files.length === 0) return
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'))
    if (csvFiles.length !== files.length) {
      show({ tone: 'error', title: 'Only .csv files are supported' })
    }
    setBusy(true)
    setProgress(csvFiles.map((f) => ({ name: f.name, percent: 0, status: 'uploading' })))
    try {
      const datasets = await uploadFiles(sessionId, csvFiles, (name, percent) =>
        setProgress((prev) => prev.map((p) => (p.name === name ? { ...p, percent } : p))),
      )
      setProgress((prev) =>
        prev.map((p) => {
          const hit = datasets.some((d) => d.filename === p.name)
          return hit ? { ...p, percent: 100, status: 'done' } : p
        }),
      )
      onUploaded(datasets)
      show({
        tone: 'success',
        title: `Imported ${datasets.length} dataset${datasets.length > 1 ? 's' : ''}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setProgress((prev) => prev.map((p) => ({ ...p, status: 'error', error: message })))
      show({ tone: 'error', title: 'Upload failed', description: message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFiles(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-7 text-center transition-colors',
          dragging
            ? 'border-iris bg-iris-soft'
            : 'border-line-strong bg-sunken/50 hover:border-iris/50 hover:bg-iris-soft/50',
        )}
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-pill bg-grad-soft text-iris-active">
          <UploadIcon size={18} />
        </div>
        <p className="text-sm font-bold text-ink">Drop CSVs here or click to browse</p>
        <p className="mt-1 text-xs text-muted">Multiple files · up to 25 MB each</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {progress.length > 0 && (
        <ul className="space-y-2">
          {progress.map((p) => (
            <li key={p.name} className="rounded-input border border-line bg-surface p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-ink">{p.name}</span>
                <span className={cn('text-muted', p.status === 'done' && 'text-leaf', p.status === 'error' && 'text-berry')}>
                  {p.status === 'error' ? 'failed' : p.status === 'done' ? 'done' : `${Math.round(p.percent)}%`}
                </span>
              </div>
              <Progress
                value={p.percent}
                tone={p.status === 'error' ? 'ember' : 'iris'}
                className="mt-1.5"
              />
              {p.error ? <p className="mt-1 text-[10px] text-berry">{p.error}</p> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-card border border-line bg-sunken/50 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          Or try a sample dataset
        </p>
        <div className="space-y-1.5">
          {SAMPLE_DATASETS.map((s) => (
            <button
              key={s.name}
              disabled={busy || !sessionId}
              onClick={() => void onSample(s.name)}
              className="flex w-full items-center justify-between rounded-input border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-iris/40 disabled:opacity-40"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-ink">{s.name}</span>
                <span className="block truncate text-[11px] text-muted">{s.description}</span>
              </span>
              <ArrowRightIcon size={14} className="shrink-0 text-iris" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
