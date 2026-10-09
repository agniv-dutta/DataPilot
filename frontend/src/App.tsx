import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DatasetInfo } from './api/types'
import { uploadFiles } from './api/datasets'
import { useToast } from './hooks/useToast'
import { ToastProvider } from './components/ui/Toast'
import { Sidebar } from './components/layout/Sidebar'
import { Inspector } from './components/layout/Inspector'
import { ChatArea } from './components/layout/ChatArea'
import { PreviewModal } from './components/datasets/PreviewModal'
import { Styleguide } from './pages/Styleguide'
import { useDatasets } from './hooks/useDatasets'
import { useSession } from './hooks/useSession'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, retry: 1 },
  },
})

function TopBar({
  onMenu,
  onInspector,
  sessionLabel,
}: {
  onMenu: () => void
  onInspector: () => void
  sessionLabel: string
}) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-borderline bg-surface px-3 sm:px-4 lg:hidden">
      <button
        onClick={onMenu}
        aria-label="Open datasets"
        className="rounded-input p-1.5 text-muted hover:bg-primary-50 hover:text-primary"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span className="truncate text-xs font-semibold text-muted">{sessionLabel}</span>
      <button
        onClick={onInspector}
        aria-label="Open inspector"
        className="rounded-input p-1.5 text-muted hover:bg-primary-50 hover:text-primary"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 3v2m6-2v2m-9 4h12M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  )
}

function AppInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [preview, setPreview] = useState<DatasetInfo | null>(null)
  const { sessionId, creating, start, clear } = useSession()
  const { datasets, list, remove } = useDatasets(sessionId)
  const { show } = useToast()

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
      show({ tone: 'error', title: 'Could not load sample', description: err instanceof Error ? err.message : undefined })
    }
  }

  const startNewSession = () => {
    clear()
    void start()
  }

  const sessionLabel = sessionId ? `Session ${sessionId.slice(0, 8)}…` : 'No session'

  return (
    <div className="flex h-screen overflow-hidden bg-app text-navy">
      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessionId={sessionId}
        creating={creating}
        onStartSession={startNewSession}
        onClearSession={startNewSession}
        datasets={datasets}
        loading={list.isLoading}
        onPreview={(d) => setPreview(d)}
        onRemove={(d) => remove.mutate(d.file_id)}
        onUploaded={() => undefined}
        onSample={loadSample}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenu={() => setSidebarOpen(true)}
          onInspector={() => setInspectorOpen(true)}
          sessionLabel={sessionLabel}
        />
        <div className="flex min-h-0 flex-1">
          <ChatArea key={sessionId ?? 'empty'} sessionId={sessionId} />
          <Inspector sessionId={sessionId} open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
        </div>
      </div>
      <PreviewModal dataset={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        {window.location.hash.startsWith('#/styleguide') ? (
          <Styleguide />
        ) : (
          <AppInner />
        )}
      </QueryClientProvider>
    </ToastProvider>
  )
}