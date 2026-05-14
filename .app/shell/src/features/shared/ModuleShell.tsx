import { useEffect, useState, type ReactNode } from 'react'
import { cn, Codicon } from '../../ui'

/**
 * ModuleShell — Photoshop-style 3-pane layout
 *
 *  ┌──────────────────────────────────────────────────────┐
 *  │ Toolbar (เครื่องมือของโมดูล)                          │
 *  ├──────────────────────────────┬───────────────────────┤
 *  │                              │                       │
 *  │  Workspace                   │  Inspector            │
 *  │  (pasteboard / artboard)     │  (right panel —       │
 *  │                              │   collapsible)        │
 *  │                              │                       │
 *  └──────────────────────────────┴───────────────────────┘
 */

export type ModuleShellProps = {
  toolbar?: ReactNode
  workspace: ReactNode
  inspector: ReactNode
  inspectorFooter?: ReactNode
}

export function ModuleShell({ toolbar, workspace, inspector, inspectorFooter }: ModuleShellProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-vscode-editor">
      {toolbar}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{workspace}</div>
        <aside
          aria-label="แผงควบคุม"
          className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-vscode-border bg-vscode-sidebar md:w-[360px] lg:w-[400px] xl:w-[440px] 2xl:w-[480px]"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            {inspector}
          </div>
          {inspectorFooter ? (
            <div className="shrink-0 border-t border-vscode-border bg-vscode-titlebar/60">
              {inspectorFooter}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

/**
 * useCollapsibleState — เก็บ openMap ของ inspector ลง localStorage
 * พร้อม versioning — ถ้าเพิ่ม section ใหม่ให้บั๊ม version จะ reset state เก่า
 */
export function useCollapsibleState<TId extends string>(
  storageKey: string,
  defaults: Record<TId, boolean>,
  version: number = 1,
): [Record<TId, boolean>, (id: TId) => void, (allOpen: boolean) => void] {
  const fullKey = `${storageKey}:v${version}`
  const [open, setOpen] = useState<Record<TId, boolean>>(() => {
    try {
      if (typeof localStorage === 'undefined') return defaults
      const raw = localStorage.getItem(fullKey)
      if (!raw) return defaults
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return { ...defaults, ...parsed }
      }
    } catch {
      /* ignore */
    }
    return defaults
  })
  useEffect(() => {
    try { localStorage.setItem(fullKey, JSON.stringify(open)) } catch { /* ignore */ }
  }, [fullKey, open])
  const toggle = (id: TId) => setOpen((p) => ({ ...p, [id]: !p[id] }))
  const setAll = (allOpen: boolean) =>
    setOpen(() =>
      Object.keys(defaults).reduce(
        (acc, k) => ({ ...acc, [k]: allOpen }),
        {} as Record<TId, boolean>,
      ),
    )
  return [open, toggle, setAll]
}

/**
 * CollapsibleSection — Photoshop-style panel section ในแผงด้านขวา
 * คลิก header เพื่อเปิด/ปิด
 */
export function CollapsibleSection({
  icon,
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  icon: string
  title: string
  open: boolean
  onToggle: () => void
  badge?: string
  children: ReactNode
}) {
  return (
    <section className="flex shrink-0 flex-col border-b border-vscode-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 shrink-0 items-center gap-1.5 bg-vscode-section-header-bg px-2.5 text-left transition-colors hover:bg-vscode-list-hover"
        aria-expanded={open}
      >
        <Codicon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={14}
          className="text-vscode-muted"
        />
        <Codicon name={icon} size={14} className="text-vscode-brand" />
        <span className="flex-1 truncate text-[12px] font-semibold uppercase tracking-[0.06em] text-vscode-fg">
          {title}
        </span>
        {badge ? (
          <span className="rounded-sm bg-vscode-brand/20 px-1.5 py-0.5 text-[10px] font-medium text-vscode-brand">
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="flex flex-col gap-3 bg-vscode-sidebar/40 p-3">{children}</div>
      ) : null}
    </section>
  )
}

/**
 * InspectorHeaderBar — แถบบนสุดของ inspector มีปุ่ม expand/collapse all
 */
export function InspectorHeaderBar({
  title,
  onExpandAll,
  onCollapseAll,
}: {
  title: string
  onExpandAll: () => void
  onCollapseAll: () => void
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-vscode-border bg-vscode-section-header-bg px-2.5">
      <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-vscode-muted">
        {title}
      </span>
      <button
        type="button"
        title="ขยายทั้งหมด"
        onClick={onExpandAll}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg"
      >
        <Codicon name="expand-all" size={13} />
      </button>
      <button
        type="button"
        title="ยุบทั้งหมด"
        onClick={onCollapseAll}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg"
      >
        <Codicon name="collapse-all" size={13} />
      </button>
    </div>
  )
}

/**
 * ToolbarBtn — ปุ่มในเครื่องมือบน (toolbar) ด้านบน workspace
 */
export function ToolbarBtn({
  title,
  icon,
  label,
  active,
  disabled,
  onClick,
  tone = 'default',
}: {
  title: string
  icon: string
  label?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  tone?: 'default' | 'primary' | 'danger'
}) {
  const toneClass = {
    default: active
      ? 'bg-vscode-list-active text-vscode-fg-bright'
      : 'text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg',
    primary: 'border border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright hover:bg-vscode-brand/25',
    danger: 'text-vscode-error hover:bg-vscode-error/10',
  }[tone]
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
        toneClass
      )}
    >
      <Codicon name={icon} size={15} />
      {label ? <span>{label}</span> : null}
    </button>
  )
}

export function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-vscode-border" aria-hidden />
}

export function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-0.5">{children}</div>
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-vscode-border bg-vscode-titlebar px-2 [scrollbar-width:thin]">
      {children}
    </div>
  )
}
