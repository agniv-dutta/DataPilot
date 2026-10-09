import { STARTER_QUESTIONS } from '../../lib/constants'

export function SuggestionChips({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STARTER_QUESTIONS.map((q) => (
        <button
          key={q}
          disabled={disabled}
          onClick={() => onPick(q)}
          className="rounded-full border border-borderline bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          {q}
        </button>
      ))}
    </div>
  )
}