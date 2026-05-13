import type { ReactNode } from 'react'
import { cn, Codicon } from '../../ui'

export type ModuleSection<TId extends string> = {
  id: TId
  label: string
  icon: string
  step?: number
  badge?: string
}

export type ModuleShellProps<TId extends string> = {
  icon: string
  title: string
  subtitle?: string
  sections: ReadonlyArray<ModuleSection<TId>>
  activeSection: TId
  onSectionChange: (id: TId) => void
  preview?: ReactNode
  children: ReactNode
}

export function ModuleShell<TId extends string>({
  icon,
  title,
  subtitle,
  sections,
  activeSection,
  onSectionChange,
  preview,
  children,
}: ModuleShellProps<TId>) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-vscode-border bg-vscode-surface px-3 py-2">
        <Codicon name={icon} className="text-vscode-brand" size={16} />
        <h2 className="text-[13px] font-semibold text-vscode-fg-bright">{title}</h2>
        {subtitle ? <span className="text-[11px] text-vscode-muted">{subtitle}</span> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)] divide-x divide-vscode-border overflow-hidden">
        <nav
          aria-label={`ส่วนของ ${title}`}
          className="flex min-h-0 flex-col gap-0.5 overflow-auto bg-vscode-sidebar p-2"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === activeSection}
              onClick={() => onSectionChange(s.id)}
              className={cn(
                'group relative flex items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-[12px] transition-colors',
                s.id === activeSection
                  ? 'border-vscode-brand/40 bg-vscode-brand/10 text-vscode-fg-bright'
                  : 'border-transparent text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
              )}
            >
              {s.step != null ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-vscode-input text-[10px] tabular-nums text-vscode-muted">
                  {s.step}
                </span>
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-vscode-muted">
                  <Codicon name={s.icon} />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.badge ? (
                <span className="shrink-0 rounded-sm bg-vscode-input px-1.5 py-0.5 text-[10px] tabular-nums text-vscode-fg-dim">
                  {s.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <section className="flex min-h-0 flex-col gap-3 overflow-auto bg-vscode-editor p-4">
          {children}
        </section>

        <aside
          aria-label="ตัวอย่าง"
          className="flex min-h-0 flex-col overflow-hidden border-l border-vscode-border bg-vscode-sidebar"
        >
          <div className="flex shrink-0 items-center gap-1.5 border-b border-vscode-border bg-vscode-section-header-bg px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-vscode-muted">
            <Codicon name="eye" />
            ตัวอย่าง
          </div>
          <div className="flex min-h-0 flex-1 overflow-auto">
            {preview ?? <EmptyPreview />}
          </div>
        </aside>
      </div>
    </div>
  )
}

function EmptyPreview() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-vscode-muted">
      <Codicon name="eye-closed" size={32} />
      <span className="text-[11px]">ยังไม่มีตัวอย่าง</span>
    </div>
  )
}
