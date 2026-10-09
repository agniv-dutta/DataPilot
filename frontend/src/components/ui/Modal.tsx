import { useEffect } from 'react'
import { cx } from '../../lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

const sizes = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onClose, title, children, size = 'lg', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cx(
          'relative w-full animate-fade-in rounded-card border border-borderline bg-surface shadow-soft',
          sizes[size],
        )}
      >
        <div className="flex items-center justify-between border-b border-borderline px-5 py-3">
          <h2 className="text-sm font-bold text-navy">{title}</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-input text-muted hover:bg-primary-50 hover:text-primary"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-borderline px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}