import { useTheme } from '../../hooks/useTheme'
import { IconButton } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { MenuIcon, MoonIcon, PlusIcon, SunIcon, TableIcon } from '../ui/icons'

export function TopBar({
  sessionLabel,
  onMenu,
  onInspector,
  onNewSession,
  creating,
}: {
  sessionLabel: string
  onMenu: () => void
  onInspector: () => void
  onNewSession: () => void
  creating: boolean
}) {
  const { theme, toggle } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-2.5 sm:px-4">
      <IconButton aria-label="Open datasets" onClick={onMenu} className="lg:hidden">
        <MenuIcon size={18} />
      </IconButton>
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden h-7 w-7 items-center justify-center rounded-input bg-hero text-canvas lg:flex">
          <TableIcon size={15} />
        </span>
        <span className="truncate text-xs font-semibold text-muted">{sessionLabel}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Tooltip label="New session">
          <span className="inline-flex">
            <IconButton aria-label="New session" onClick={onNewSession} disabled={creating}>
              <PlusIcon size={17} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip label="Toggle theme">
          <span className="inline-flex">
            <IconButton aria-label="Toggle theme" onClick={toggle}>
              {theme === 'dark' ? <SunIcon size={17} /> : <MoonIcon size={17} />}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton aria-label="Open inspector" onClick={onInspector} className="lg:hidden">
          <TableIcon size={17} />
        </IconButton>
      </div>
    </header>
  )
}
