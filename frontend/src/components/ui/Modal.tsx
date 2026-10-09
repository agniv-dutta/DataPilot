import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { CloseIcon } from './icons'

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
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-[55] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            'overflow-hidden rounded-card border border-line bg-surface shadow-lift',
            'data-[state=open]:animate-slide-up focus:outline-none',
            sizes[size],
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-sm font-bold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-input text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <CloseIcon size={16} />
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  side?: 'right' | 'left'
  width?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-y-0 z-[55] flex w-[calc(100%-3rem)] flex-col border-line bg-surface shadow-lift focus:outline-none',
            side === 'right'
              ? 'right-0 border-l data-[state=open]:animate-[slideInRight_0.3s_cubic-bezier(0.16,1,0.3,1)]'
              : 'left-0 border-r',
            width,
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-sm font-bold text-ink">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-input text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <CloseIcon size={16} />
            </Dialog.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
