import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const base =
  'w-full rounded-input border border-line-strong bg-sunken px-3 text-sm text-ink placeholder:text-muted/80 ' +
  'transition-colors outline-none focus:border-iris focus:shadow-focus disabled:opacity-50'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name
  return (
    <label className="block" htmlFor={inputId}>
      {label ? <span className="mb-1.5 block text-xs font-semibold text-ink">{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(base, 'h-10', error && 'border-berry focus:border-berry', className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <span className="mt-1 block text-[11px] text-berry">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  )
})

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, id, ...rest },
  ref,
) {
  const areaId = id ?? rest.name
  return (
    <label className="block" htmlFor={areaId}>
      {label ? <span className="mb-1.5 block text-xs font-semibold text-ink">{label}</span> : null}
      <textarea ref={ref} id={areaId} className={cn(base, 'py-2', className)} {...rest} />
    </label>
  )
})
