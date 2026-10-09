import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DatasetInfo } from './api/types'
import { uploadFiles } from './api/datasets'
import { useToast } from './hooks/useToast'
import { ToastProvider } from './components/ui/Toast'
import { TooltipProvider } from './components/ui/Tooltip'
import { Sidebar } from './components/layout/Sidebar'
import { Inspector } from './components/layout/Inspector'
import { ChatArea } from './components/layout/ChatArea'
import { TopBar } from './components/layout/TopBar'
import { PreviewModal } from './components/datasets/PreviewModal'
import { Styleguide } from './pages/Styleguide'
import { Landing } from './pages/Landing'
import { useDatasets } from './hooks/useDatasets'
import { useSession } from './hooks/useSession'
import { usePathname } from './lib/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5000, retry: 1 },
  },
})

function Workspace() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [preview, setPreview] = useState<DatasetInfo | null>(null)
  const { sessionId, creating, reset } = useSession()
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
      show({
        tone: 'error',
        title: 'Could not load sample',
        description: err instanceof Error ? err.message : undefined,
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
          onRemove={(d) => remove.mutate(d.file_id)}
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
    </div>
  )
}

function Router() {
  const path = usePathname()
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  if (path.startsWith('/styleguide') || hash.startsWith('#/styleguide')) return <Styleguide />
  if (path === '/' || path === '') return <Landing />
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
