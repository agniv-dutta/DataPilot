import { useState } from 'react'
import { Button } from '../ui/Button'

export function InputBox({
  onSend,
  disabled,
  placeholder = 'Ask anything about your data…',
}: {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState('')

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <div className="border-t border-borderline bg-surface p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={disabled ? 'Working…' : placeholder}
            aria-label="Message"
            className="min-h-[44px] w-full resize-none rounded-input border border-borderline bg-app px-3 py-2.5 text-sm text-navy placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button onClick={submit} disabled={disabled || !value.trim()} aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 11.5 21 3l-8.5 18-2.5-8.5L3 11.5Z" fill="currentColor" stroke="currentColor" />
          </svg>
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  )
}