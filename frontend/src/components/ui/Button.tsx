import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const button = cva(
  [
    'relative inline-flex items-center justify-center gap-2 rounded-input font-semibold',
    'transition-all duration-150 ease-out-expo select-none',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-iris text-surface shadow-soft',
          'hover:bg-iris-hover hover:-translate-y-px hover:shadow-lift',
          'active:translate-y-0 active:bg-iris-active',
        ],
        soft: [
          'bg-iris-soft text-iris-active border border-iris/25',
          'hover:border-iris/45 hover:bg-iris/20',
        ],
        ghost: 'text-muted hover:bg-sunken hover:text-ink',
        ember: [
          'bg-ember text-canvas shadow-soft',
          'hover:-translate-y-px hover:shadow-lift hover:brightness-105',
          'active:brightness-95',
        ],
        outline: 'border border-line-strong text-ink hover:bg-sunken',
        danger: 'bg-berry text-surface hover:brightness-110 active:brightness-95',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      pill: { true: 'rounded-pill', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', pill: false },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, pill, loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(button({ variant, size, pill }), className)}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
})

export function IconButton({
  className,
  active,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string; active?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-input text-muted transition-colors',
        'hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:shadow-focus',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-iris-soft text-iris-active',
        className,
      )}
      {...rest}
    />
  )
}
