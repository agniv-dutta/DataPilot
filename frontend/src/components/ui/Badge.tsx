import { cn } from '../../lib/utils'

type Tone = 'iris' | 'ember' | 'orchid' | 'periwinkle' | 'berry' | 'leaf' | 'neutral'

const tones: Record<Tone, string> = {
  iris: 'bg-iris-soft text-iris-active border-iris/25',
  ember: 'bg-ember-soft text-ember border-ember/30',
  orchid: 'bg-orchid-soft text-orchid border-orchid/30',
  periwinkle: 'bg-periwinkle-soft text-periwinkle border-periwinkle/30',
  berry: 'bg-berry-soft text-berry border-berry/30',
  leaf: 'bg-leaf-soft text-leaf border-leaf/30',
  neutral: 'bg-sunken text-muted border-line',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Pill({
  active,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-40',
        active
          ? 'border-iris/40 bg-iris-soft text-iris-active'
          : 'border-line bg-surface text-muted hover:border-iris/30 hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
