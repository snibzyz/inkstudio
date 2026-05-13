import { cn, Codicon } from '../ui'
import { MODULE_META, MODULE_ORDER, useApp, type ModuleId } from '../state/useApp'

export function Sidebar() {
  const active = useApp((s) => s.activeModule)
  const setActive = useApp((s) => s.setActiveModule)

  return (
    <nav
      aria-label="โมดูล INKSTUDIO"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-vscode-border bg-vscode-sidebar py-2"
    >
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-sm text-vscode-brand">
        <Codicon name="symbol-method" size={18} />
      </div>

      {MODULE_ORDER.map((id) => (
        <SidebarItem
          key={id}
          id={id}
          active={active === id}
          onSelect={setActive}
        />
      ))}
    </nav>
  )
}

function SidebarItem({
  id,
  active,
  onSelect,
}: {
  id: ModuleId
  active: boolean
  onSelect: (id: ModuleId) => void
}) {
  const meta = MODULE_META[id]
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={`${meta.label} — ${meta.description}`}
      onClick={() => onSelect(id)}
      className={cn(
        'group relative flex h-10 w-10 flex-col items-center justify-center rounded-sm transition-colors',
        active
          ? 'bg-vscode-list-active text-vscode-fg-bright'
          : 'text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm transition-colors',
          active ? 'bg-vscode-brand' : 'bg-transparent'
        )}
      />
      <Codicon name={meta.icon} size={18} />
      <span className="mt-0.5 text-[9px] font-medium leading-none">{meta.label}</span>
    </button>
  )
}
