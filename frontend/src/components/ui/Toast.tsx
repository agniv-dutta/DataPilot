import { useCallback, useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { ToastContext } from '../../hooks/useToast'
import type { Toast } from '../../hooks/useToast'
import { AlertIcon, CheckIcon, CloseIcon, SparkIcon } from './icons'

const toneStyles: Record<Toast['tone'], string> = {
  info: 'border-iris/30 bg-surface text-ink',
  error: 'border-berry/40 bg-berry-soft text-ink',
  success: 'border-leaf/40 bg-leaf-soft text-ink',
}

const toneIcon: Record<Toast['tone'], React.ReactNode> = {
  info: <SparkIcon size={14} />,
  error: <AlertIcon size={14} />,
  success: <CheckIcon size={14} />,
}

const toneAccent: Record<Toast['tone'], string> = {
  info: 'bg-iris-soft text-iris-active',
  error: 'bg-berry/15 text-berry',
  success: 'bg-leaf/15 text-leaf',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `toast_${++counter}_${Math.random().toString(36).slice(2, 6)}`
      setToasts((prev) => [...prev, { ...t, id }])
      window.setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto animate-slide-up rounded-card border p-3 shadow-lift backdrop-blur',
              toneStyles[t.tone],
            )}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-input',
                  toneAccent[t.tone],
                )}
              >
                {toneIcon[t.tone]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-xs text-muted">{t.description}</p>
                ) : null}
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="text-muted transition-colors hover:text-ink"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

let counter = 0
