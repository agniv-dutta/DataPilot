import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'
import { IconButton } from '../ui/Button'
import { Kbd } from '../ui/Kbd'
import { SendIcon, StopIcon } from '../ui/icons'

export function InputBox({
  onSend,
  onStop,
  streaming = false,
  disabled = false,
  placeholder = 'Ask anything about your data…',
  autoFocus = false,
}: {
  onSend: (message: string) => void
  onStop?: () => void
  streaming?: boolean
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [value])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const submit = () => {
    const text = value.trim()
    if (!text || disabled || streaming) return
    onSend(text)
    setValue('')
  }

  return (
    <div className="pointer-events-none px-3 pb-3 sm:px-6 sm:pb-5">
      <div
        className={cn(
          'pointer-events-auto mx-auto flex w-full max-w-3xl items-end gap-2 rounded-frame border border-line bg-surface/90 p-2 pl-3 shadow-lift backdrop-blur',
          'transition-colors focus-within:border-iris/40',
        )}
      >
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          disabled={disabled}
          placeholder={disabled ? 'Load a dataset to begin…' : placeholder}
          aria-label="Message"
          className="scrollbar-thin max-h-[180px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-ink placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
        />
        {streaming ? (
          <button
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-ember-soft px-3 text-xs font-semibold text-ember transition-colors hover:bg-ember/20"
          >
            <StopIcon size={14} />
            Stop
          </button>
        ) : (
          <IconButton
            aria-label="Send message"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className={cn(
              'h-9 w-9 shrink-0 rounded-pill transition-all',
              value.trim() && !disabled
                ? 'bg-hero text-canvas shadow-soft hover:-translate-y-px hover:shadow-lift'
                : 'bg-sunken text-muted',
            )}
          >
            <SendIcon size={16} />
          </IconButton>
        )}
      </div>
      <p className="pointer-events-none mt-1.5 flex items-center justify-center gap-1 text-[11px] text-muted">
        <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line
      </p>
    </div>
  )
}
