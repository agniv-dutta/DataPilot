import { useState } from 'react'
import { cx } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
  content: React.ReactNode
  badge?: number
}

export function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const activeItem = items.find((i) => i.id === active) ?? items[0]

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sections"
        className="flex border-b border-borderline"
      >
        {items.map((item) => {
          const selected = item.id === activeItem?.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(item.id)}
              className={cx(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
                selected
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-navy',
              )}
            >
              {item.label}
              {item.badge ? (
                <span className="rounded-full bg-primary-100 px-1.5 text-[10px] text-primary-700">
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="pt-3">{activeItem?.content}</div>
    </div>
  )
}