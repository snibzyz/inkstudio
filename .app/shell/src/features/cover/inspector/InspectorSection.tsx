import { ChevronDown } from 'lucide-react'
import { cn } from '@shared/ui'

export function InspectorSection({
  id,
  title,
  icon,
  open,
  onToggle,
  actions,
  children,
  hint,
}: {
  id: string
  title: string
  icon?: React.ReactNode
  open: boolean
  onToggle: () => void
  actions?: React.ReactNode
  children: React.ReactNode
  hint?: string
}) {
  return (
    <section className="border-b border-vscode-border last:border-b-0" aria-labelledby={`${id}-h`}>
      <header className="flex items-center gap-1 bg-vscode-section-header-bg px-1.5 py-[5px]">
        <button
          type="button"
          id={`${id}-h`}
          onClick={onToggle}
          aria-expanded={open}
          title={hint ?? `${open ? 'ปิด' : 'เปิด'} ${title}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-vscode-list-hover"
        >
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-vscode-muted transition-transform',
              open ? '' : '-rotate-90'
            )}
            aria-hidden
          />
          {icon ? <span className="shrink-0 text-vscode-muted">{icon}</span> : null}
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-vscode-muted">
            {title}
          </span>
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-0.5 pr-1">{actions}</div> : null}
      </header>
      {open ? <div className="px-3 py-3">{children}</div> : null}
    </section>
  )
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1 text-[11px] font-medium text-vscode-fg-dim" title={hint}>
      {children}
    </div>
  )
}

export function SubGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {title ? (
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-vscode-muted/70">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  disabled,
  onReset,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  display?: string
  disabled?: boolean
  onReset?: () => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-vscode-fg-dim">
        <span className="truncate">{label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="tabular-nums text-vscode-muted">{display ?? value.toFixed(2)}</span>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              disabled={disabled}
              className="rounded-sm px-1 text-[10px] text-vscode-muted hover:bg-vscode-list-hover hover:text-vscode-fg disabled:opacity-30"
              title="รีเซ็ตค่านี้"
            >
              ↺
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-vscode-focus disabled:opacity-40"
      />
    </label>
  )
}

export function IconBtnSm({
  title,
  onClick,
  disabled,
  children,
  className,
}: {
  title: string
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-sm text-vscode-muted transition-colors',
        'hover:bg-vscode-list-hover hover:text-vscode-fg',
        'disabled:pointer-events-none disabled:opacity-35',
        className
      )}
    >
      {children}
    </button>
  )
}
