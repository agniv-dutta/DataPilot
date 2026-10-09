import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
  content: React.ReactNode
  badge?: number
}

export function Tabs({
  items,
  value,
  onValueChange,
  className,
}: {
  items: TabItem[]
  value?: string
  onValueChange?: (id: string) => void
  className?: string
}) {
  const [internal, setInternal] = useState(items[0]?.id ?? '')
  const active = value ?? internal
  const activeItem = items.find((i) => i.id === active) ?? items[0]
  const listRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  const select = useCallback(
    (id: string) => {
      if (value === undefined) setInternal(id)
      onValueChange?.(id)
    },
    [value, onValueChange],
  )

  const measure = useCallback(() => {
    const el = tabRefs.current[active]
    const list = listRef.current
    if (!el || !list) return
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active])

  useLayoutEffect(measure, [measure, items.length])
  useEffect(() => {
    const ro = new ResizeObserver(measure)
    if (listRef.current) ro.observe(listRef.current)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div className={className}>
      <div ref={listRef} role="tablist" className="relative flex gap-1 border-b border-line">
        {items.map((item) => {
          const selected = item.id === active
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[item.id] = el
              }}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(e) => {
                const idx = items.findIndex((i) => i.id === active)
                if (e.key === 'ArrowRight') select(items[(idx + 1) % items.length]?.id ?? active)
                if (e.key === 'ArrowLeft')
                  select(items[(idx - 1 + items.length) % items.length]?.id ?? active)
              }}
              className={cn(
                'relative -mb-px flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:rounded-input focus-visible:shadow-focus',
                selected ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {item.label}
              {item.badge ? (
                <span className="rounded-pill bg-iris-soft px-1.5 text-[10px] text-iris-active">
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
        <span
          aria-hidden
          className="absolute -bottom-px h-0.5 rounded-pill bg-hero transition-all duration-250 ease-out-expo"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
      <div className="pt-3">{activeItem?.content}</div>
    </div>
  )
}
