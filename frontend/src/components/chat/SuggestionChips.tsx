import { STARTER_QUESTIONS } from '../../lib/constants'
import { AlertIcon, MapIcon, TrendIcon, UsersIcon } from '../ui/icons'

const ICONS = {
  trend: TrendIcon,
  map: MapIcon,
  users: UsersIcon,
  alert: AlertIcon,
}

export function SuggestionChips({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void
  disabled?: boolean
}) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
      {STARTER_QUESTIONS.map((item) => {
        const Icon = ICONS[item.icon]
        return (
          <button
            key={item.question}
            disabled={disabled}
            onClick={() => onPick(item.question)}
            className="group flex items-start gap-3 rounded-card border border-line bg-surface p-3 text-left shadow-soft transition-all duration-150 ease-out-expo hover:-translate-y-0.5 hover:border-iris/35 hover:shadow-lift disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input bg-iris-soft text-iris-active transition-colors group-hover:bg-hero group-hover:text-canvas">
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{item.question}</span>
              <span className="mt-0.5 block text-[11px] text-muted">{item.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
