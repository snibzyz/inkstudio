import { useCallback, useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils/cn'

const SIZE_CLASS = {
  lg: 'max-w-[min(92vw,36rem)]',
  xl: 'max-w-[min(94vw,52rem)]',
  '2xl': 'max-w-[min(96vw,68rem)]',
} as const

export type IdeDialogSize = keyof typeof SIZE_CLASS

export type IdeDialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: IdeDialogSize
  tone?: 'default' | 'danger'
  headerEnd?: ReactNode
  closeOnOverlayClick?: boolean
  className?: string
}

/** Modal แบบ VS Code (portal ไปที่ body) */
export function IdeDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'xl',
  tone = 'default',
  headerEnd,
  closeOnOverlayClick = true,
  className,
}: IdeDialogProps) {
  const titleId = useId()
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onKeyDown])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="ปิดหน้าต่าง"
        className="absolute inset-0 bg-black/50"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex max-h-[min(90vh,920px)] w-full flex-col overflow-hidden rounded-sm border border-vscode-border',
          'bg-vscode-editor shadow-[0_16px_48px_rgba(0,0,0,0.55)]',
          SIZE_CLASS[size],
          tone === 'danger' && 'border-vscode-error/45',
          className
        )}
      >
        <header
          className={cn(
            'flex shrink-0 items-start justify-between gap-4 border-b border-vscode-border bg-vscode-titlebar px-4 py-3 sm:px-5',
            tone === 'danger' && 'border-b-vscode-error/35'
          )}
        >
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[13px] font-semibold leading-snug text-vscode-fg-bright">
              {title}
            </h2>
            {description ? (
              <div className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-vscode-muted">{description}</div>
            ) : null}
          </div>
          {headerEnd ? <div className="shrink-0">{headerEnd}</div> : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">{children}</div>

        {footer ? (
          <footer className="shrink-0 border-t border-vscode-border bg-vscode-sidebar px-4 py-3 sm:px-5">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
