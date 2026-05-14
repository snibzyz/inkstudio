import type { ReactNode } from 'react'
import { cn } from '../utils/cn'
import { hubExplorerHeader } from '../hubChrome'
import { HubCompositeTitle } from './HubCompositeTitle'

type VsCodeExplorerPanelProps = {
  title: string
  /** li.action-item ภายใน ul.actions-container — รับ ReactNode list */
  actions?: ReactNode
  /** ไอคอน codicon ก่อนชื่อ (เช่น 'codicon-search-view-icon') */
  viewIcon?: string
  meta?: ReactNode
  children: ReactNode
  className?: string
  /** ซ่อนหัวแบบ Explorer ด้านบน (ใช้กับ Search ที่มี pane header เอง) */
  hideChromeHeader?: boolean
  /** `composite` (default) = composite title bar + h2 ตาม VS Code · `well` = แถบ h-9 เดิม · `section` = pane-header เดิม (legacy) */
  headerVariant?: 'composite' | 'section' | 'well'
}

export function VsCodeExplorerPanel({
  title,
  actions,
  viewIcon,
  meta,
  children,
  className,
  hideChromeHeader,
  headerVariant = 'composite',
}: VsCodeExplorerPanelProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden bg-vscode-sidebar', className)}>
      {!hideChromeHeader ? (
        headerVariant === 'composite' ? (
          <HubCompositeTitle title={title} actions={actions} viewIcon={viewIcon} />
        ) : headerVariant === 'section' ? (
          <div
            className="inkidea-view-pane-header pane-header expanded vertical shrink-0 justify-between"
            role="region"
            aria-label={title}
          >
            <div
              className="twisties-container-in-view-pane-header twisty-container codicon-view-pane-container-expanded codicon"
              aria-hidden
            />
            <h3 className="title">{title}</h3>
            {actions ? (
              <div className="actions" onPointerDown={(e) => e.stopPropagation()}>
                <div className="monaco-toolbar">
                  <div className="monaco-action-bar flex items-center gap-0.5 text-vscode-muted [&_.codicon]:text-[16px]">
                    {actions}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <header className={cn(hubExplorerHeader, 'justify-between')}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[11px] font-normal uppercase tracking-[0.08em] text-vscode-muted">
                {title}
              </span>
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-1 text-vscode-muted">{actions}</div> : null}
          </header>
        )
      ) : null}

      {meta ? (
        <div className="border-b border-vscode-border bg-vscode-surface px-3 py-1 text-[10px] text-vscode-muted">
          {meta}
        </div>
      ) : null}

      {children}
    </div>
  )
}
