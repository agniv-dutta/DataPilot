import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

export function Switch({
  checked,
  onCheckedChange,
  className,
  label,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  className?: string
  label?: string
}) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2', className)}>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-pill border border-line transition-colors duration-150',
          'focus-visible:outline-none focus-visible:shadow-focus',
          'data-[state=checked]:bg-iris data-[state=unchecked]:bg-sunken',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'block h-[18px] w-[18px] translate-x-0.5 rounded-pill bg-surface shadow-soft transition-transform duration-150 ease-out-expo',
            'data-[state=checked]:translate-x-[22px]',
          )}
        />
      </SwitchPrimitive.Root>
      {label ? <span className="text-sm text-ink">{label}</span> : null}
    </label>
  )
}
