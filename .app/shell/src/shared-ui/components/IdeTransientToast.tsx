import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils/cn'

export type IdeTransientToastVariant = 'success' | 'error' | 'info'

export type IdeTransientToastProps = {
  open: boolean
  message: string
  variant?: IdeTransientToastVariant
  /** 0 = ไม่ปิดอัตโนมัติ */
  durationMs?: number
  onClose: () => void
}

/**
 * Toast มุมล่างขวา (portal → body) สำหรับ feedback ชัด ๆ หลัง action —
 * ไม่ถูก sidebar overflow/z-index บัง
 */
export function IdeTransientToast({
  open,
  message,
  variant = 'info',
  durationMs = 4200,
  onClose,
}: IdeTransientToastProps) {
  useEffect(() => {
    if (!open || !message || durationMs <= 0) return
    const t = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(t)
  }, [open, message, durationMs, onClose])

  if (!open || !message || typeof document === 'undefined') return null

  const tones: Record<IdeTransientToastVariant, string> = {
    success:
      'border-vscode-success/55 bg-vscode-editor/[0.96] text-vscode-success shadow-[0_8px_28px_rgba(0,0,0,0.45)]',
    error:
      'border-vscode-error/55 bg-vscode-error-bg/[0.95] text-vscode-error shadow-[0_8px_28px_rgba(0,0,0,0.45)]',
    info: 'border-vscode-border bg-vscode-editor/[0.96] text-vscode-fg-bright shadow-[0_8px_28px_rgba(0,0,0,0.4)]',
  }

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[320] flex max-w-[min(94vw,22rem)] justify-end"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto rounded-sm border px-3.5 py-2.5 text-[13px] font-medium leading-snug',
          tones[variant]
        )}
      >
        {message}
      </div>
    </div>,
    document.body
  )
}
