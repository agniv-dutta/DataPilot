import { createContext, useContext } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  tone: 'info' | 'error' | 'success'
}

export interface ToastContextValue {
  show: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}