import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

type HubCompositeTitleProps = {
  /** ชื่อ view ตัวใหญ่ตรงหัวแผง (ผ่านเป็น h2) */
  title: string
  /** ปุ่ม toolbar ขวา (li.action-item ภายใน ul) */
  actions?: ReactNode
  /** ลาก = ใช้ใน multi-pane เพื่อย้าย view; ปกติเปิดไว้ */
  draggable?: boolean
  /** codicon class ก่อน h2 — เช่น 'codicon-explorer-view-icon' */
  viewIcon?: string
  className?: string
}

/**
 * Composite title bar — โครง DOM ตรงกับ VS Code workbench:
 *   .composite.title.has-actions
 *     .title-label > h2
 *     .title-actions > .monaco-toolbar > .monaco-action-bar > ul.actions-container
 *     .global-actions
 *
 * ใช้ที่หัวบนสุดของแต่ละ side panel (Search / Explorer / Source Control / ฯลฯ)
 * — ใต้ตัวนี้ pane-header ภายในควรซ่อน (merged-header)
 */
export function HubCompositeTitle({
  title,
  actions,
  draggable = true,
  viewIcon,
  className,
}: HubCompositeTitleProps) {
  return (
    <div
      className={cn(
        'composite title has-actions inkidea-composite-title',
        className
      )}
    >
      <div className="title-label inkidea-composite-title__label">
        {viewIcon ? (
          <span
            className={cn('inkidea-composite-title__icon codicon', viewIcon)}
            aria-hidden
          />
        ) : null}
        <h2 draggable={draggable}>{title}</h2>
      </div>
      {actions ? (
        <div className="title-actions inkidea-composite-title__actions" onPointerDown={(e) => e.stopPropagation()}>
          <div className="monaco-toolbar">
            <div className="monaco-action-bar">
              <ul className="actions-container" role="toolbar" aria-label={`${title} actions`}>
                {actions}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
      <div className="global-actions has-no-actions" aria-hidden />
    </div>
  )
}
