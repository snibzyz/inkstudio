import { cn } from '../utils/cn'
import { hubIdeBreadcrumbBar } from '../hubChrome'

export type HubIdeBreadcrumbSegment = {
  label: string
  title?: string
  onClick?: () => void
}

type HubIdeBreadcrumbBarProps = {
  segments: HubIdeBreadcrumbSegment[]
  className?: string
}

/** แถบ breadcrumb แบบ VS Code — ใต้แถบแท็บ editor */
export function HubIdeBreadcrumbBar({ segments, className }: HubIdeBreadcrumbBarProps) {
  if (segments.length === 0) {
    return (
      <div className={cn(hubIdeBreadcrumbBar, className)} aria-hidden>
        <span className="text-vscode-muted">—</span>
      </div>
    )
  }

  return (
    <nav className={cn(hubIdeBreadcrumbBar, className)} aria-label="เส้นทางไฟล์">
      <ol className="flex min-w-0 list-none flex-wrap items-center gap-0 p-0">
        {segments.map((seg, i) => (
          <li key={`${i}-${seg.label}`} className="flex min-w-0 items-center">
            {i > 0 ? (
              <span className="mx-1 shrink-0 text-[10px] text-vscode-muted select-none" aria-hidden>
                ›
              </span>
            ) : null}
            {seg.onClick ? (
              <button
                type="button"
                title={seg.title ?? seg.label}
                className="max-w-[200px] truncate rounded-sm px-0.5 text-left font-mono text-[11px] text-vscode-fg-dim transition-colors hover:bg-vscode-list-hover hover:text-vscode-fg-bright"
                onClick={seg.onClick}
              >
                {seg.label}
              </button>
            ) : (
              <span
                className="max-w-[240px] truncate font-mono text-[11px] text-vscode-fg-dim"
                title={seg.title ?? seg.label}
              >
                {seg.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
