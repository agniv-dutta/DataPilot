import { useCallback, useMemo, useState } from 'react'
import { cx } from '../../lib/utils'
import { ToastContext } from '../../hooks/useToast'
import type { Toast } from '../../hooks/useToast'

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
            className={cx(
              'pointer-events-auto animate-slide-up rounded-card border p-3 shadow-soft backdrop-blur',
              t.tone === 'error' && 'border-red-200 bg-red-50 text-red-800',
              t.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
              t.tone === 'info' && 'border-primary-200 bg-white text-navy',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">{t.title}</p>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="text-xs opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
            {t.description ? <p className="mt-0.5 text-xs opacity-80">{t.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

let counter = 0