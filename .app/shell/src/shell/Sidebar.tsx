import { cn, Codicon } from '../ui'
import { MODULE_META, MODULE_ORDER, useApp, type ModuleId } from '../state/useApp'

export function Sidebar() {
  const active = useApp((s) => s.activeModule)
  const setActive = useApp((s) => s.setActiveModule)

  return (
    <nav
      aria-label="โมดูลของ INKSTUDIO"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-vscode-border bg-vscode-titlebar py-2"
    >
      {/* Logo / brand mark */}
      <div
        title="INKSTUDIO"
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-sm bg-vscode-brand/15 text-vscode-brand ring-1 ring-inset ring-vscode-brand/30"
      >
        <Codicon name="symbol-method" size={22} />
      </div>

      <div className="my-1 h-px w-7 bg-vscode-border" aria-hidden />

      {/* Module activity bar */}
      {MODULE_ORDER.map((id) => (
        <SidebarItem
          key={id}
          id={id}
          active={active === id}
          onSelect={setActive}
        />
      ))}

      {/* Bottom spacer + version chip */}
      <div className="flex-1" aria-hidden />
      <div
        title="เวอร์ชันของ INKSTUDIO"
        className="mb-1 select-none text-[9px] font-semibold tabular-nums text-vscode-muted"
      >
        v0.1.0
      </div>
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
        'group relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-sm transition-colors',
        active
          ? 'bg-vscode-list-active text-vscode-fg-bright'
          : 'text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-2 bottom-2 w-[2px] rounded-r-sm transition-colors',
          active ? 'bg-vscode-brand' : 'bg-transparent'
        )}
      />
      <Codicon name={meta.icon} size={22} />
      <span className="text-[10px] font-medium leading-none">{meta.label}</span>
    </button>
  )
}
