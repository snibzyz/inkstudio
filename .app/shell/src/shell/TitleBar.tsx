import { Codicon } from '../ui'
import { MODULE_META, useApp } from '../state/useApp'

export function TitleBar() {
  const active = useApp((s) => s.activeModule)
  const meta = MODULE_META[active]

  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-vscode-border bg-vscode-titlebar px-3 text-[12px]">
      <Codicon name={meta.icon} size={14} className="text-vscode-brand" />
      <span className="font-semibold text-vscode-fg-bright">INKSTUDIO</span>
      <span className="text-vscode-muted">·</span>
      <span className="text-vscode-fg-dim">{meta.label}</span>
    </header>
  )
}
