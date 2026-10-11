import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DatasetInfo } from './api/types'
import { uploadFiles } from './api/datasets'
import { useToast } from './hooks/useToast'
import { Button } from './components/ui/Button'
import { ToastProvider } from './components/ui/Toast'
import { TooltipProvider } from './components/ui/Tooltip'
import { AlertIcon } from './components/ui/icons'
import { Sidebar } from './components/layout/Sidebar'
import { Inspector } from './components/layout/Inspector'
import { ChatArea } from './components/layout/ChatArea'
import { TopBar } from './components/layout/TopBar'
import { PreviewModal } from './components/datasets/PreviewModal'
import { useDatasets } from './hooks/useDatasets'
import { useSession } from './hooks/useSession'
import { navigate, usePathname } from './lib/router'

// Marketing and docs routes are code-split out of the app bundle.
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })))
const Styleguide = lazy(() => import('./pages/Styleguide').then((m) => ({ default: m.Styleguide })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, retry: 1 },
  },
})

function Workspace() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [preview, setPreview] = useState<DatasetInfo | null>(null)
  const { sessionId, creating, failed, retry, reset } = useSession()
  const { datasets, list, remove } = useDatasets(sessionId)
  const { show } = useToast()
  const listRef = useRef(list)
  listRef.current = list

  // A failed dataset refresh deserves an explicit toast + retry (the sidebar
  // alone would just look stuck).
  useEffect(() => {
    if (!list.isError) return
    show({
      tone: 'error',
      title: 'Could not load datasets',
      description: list.error instanceof Error ? list.error.message : undefined,
      action: { label: 'Retry', onClick: () => void listRef.current.refetch() },
    })
  }, [list.isError, list.error, show])

  const removeDataset = (d: DatasetInfo) => {
    remove.mutate(d.file_id, {
      onError: (err) =>
        show({
          tone: 'error',
          title: `Could not remove ${d.filename}`,
          description: err instanceof Error ? err.message : undefined,
          action: { label: 'Retry', onClick: () => remove.mutate(d.file_id) },
        }),
    })
  }

  const loadSample = async (name: string) => {
    if (!sessionId) return
    try {
      const res = await fetch(`/samples/${name}`)
      if (!res.ok) throw new Error(`Sample not found: ${name}`)
      const blob = await res.blob()
      const file = new File([blob], name, { type: 'text/csv' })
      const imported = await uploadFiles(sessionId, [file])
      if (imported.length > 0) {
        show({ tone: 'success', title: `Loaded ${name}` })
      }
    } catch (err) {
      show({
        tone: 'error',
        title: 'Could not load sample',
        description: err instanceof Error ? err.message : undefined,
        action: { label: 'Retry', onClick: () => void loadSample(name) },
      })
    }
  }

  const sessionLabel = sessionId
    ? `Session ${sessionId.slice(0, 8)}`
    : creating
      ? 'Starting session…'
      : 'No session'

  return (
    <div className="h-screen bg-canvas lg:p-3">
      <div className="grain relative flex h-full overflow-hidden border-line bg-surface lg:rounded-frame lg:border lg:shadow-lift">
        <Sidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessionId={sessionId}
          creating={creating}
          onNewSession={reset}
          datasets={datasets}
          loading={list.isLoading}
          onPreview={(d) => setPreview(d)}
          onRemove={removeDataset}
          onUploaded={() => undefined}
          onSample={loadSample}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            sessionLabel={sessionLabel}
            onMenu={() => setSidebarOpen(true)}
            onInspector={() => setInspectorOpen(true)}
            onNewSession={reset}
            creating={creating}
          />
          <div className="flex min-h-0 flex-1">
            <ChatArea key={sessionId ?? 'booting'} sessionId={sessionId} />
            <Inspector
              sessionId={sessionId}
              open={inspectorOpen}
              onClose={() => setInspectorOpen(false)}
            />
          </div>
        </div>
      </div>
      <PreviewModal dataset={preview} onClose={() => setPreview(null)} />
      {failed && <BackendDown creating={creating} onRetry={retry} />}
    </div>
  )
}

/** Full-screen takeover while the API cannot be reached; the workspace stays
 *  mounted underneath so reconnecting restores the conversation as-is. */
function BackendDown({ creating, onRetry }: { creating: boolean; onRetry: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-label="Backend unreachable"
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 text-center shadow-lift">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-pill bg-berry-soft text-berry">
          <AlertIcon size={20} />
        </span>
        <h2 className="mt-3 font-display text-base font-bold text-ink">Can&rsquo;t reach the backend</h2>
        <p className="mt-1.5 text-sm text-muted">
          The API is not responding. Your workspace is untouched &mdash; reconnect to pick up where you
          left off.
        </p>
        <Button className="mt-4 w-full" onClick={onRetry} loading={creating}>
          Retry connection
        </Button>
        <p className="mt-3 font-mono text-[10px] text-muted">
          python -m uvicorn app.main:app --port 8000
        </p>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <p className="font-mono text-xs tracking-wide text-iris">404 · no such range</p>
      <h1 className="text-display-m text-ink">This cell is empty</h1>
      <p className="max-w-sm text-sm text-muted">
        The page you asked for does not exist. Head back to the landing page or open the workspace.
      </p>
      <div className="mt-1 flex gap-2">
        <Button onClick={() => navigate('/')}>Back to home</Button>
        <Button variant="outline" onClick={() => navigate('/app')}>
          Open the app
        </Button>
      </div>
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-iris border-t-transparent"
        />
        <p className="text-xs text-muted">Loading…</p>
      </div>
    </div>
  )
}

const KNOWN_PATHS = new Set(['/', '', '/app', '/styleguide'])

function Router() {
  const path = usePathname()
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  if (path.startsWith('/styleguide') || hash.startsWith('#/styleguide'))
    return (
      <Suspense fallback={<RouteFallback />}>
        <Styleguide />
      </Suspense>
    )
  if (path === '/' || path === '')
    return (
      <Suspense fallback={<RouteFallback />}>
        <Landing />
      </Suspense>
    )
  if (!KNOWN_PATHS.has(path.replace(/\/+$/, ''))) return <NotFound />
  return <Workspace />
}

export function App() {
  return (
    <ToastProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <Router />
        </QueryClientProvider>
      </TooltipProvider>
    </ToastProvider>
  )
}
