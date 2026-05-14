/**
 * HubSettingsHero — hero header สำหรับหน้าตั้งค่า
 * ตัด h1 title ออกเพราะซ้ำกับ tab strip + breadcrumb ของแอป
 * เก็บไว้แค่ icon + subtitle + description เพื่อให้ผู้ใช้ scan บริบทได้เร็ว
 */

import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function HubSettingsHero({
  icon,
  title,
  titleTooltip,
  subtitle,
  description,
  meta,
  className,
}: {
  icon?: ReactNode
  /** title — ใช้เป็น aria-label/tooltip เท่านั้น ไม่แสดงข้อความ */
  title: string
  titleTooltip?: string
  /** ข้อความเสริมสั้น ๆ — โชว์เป็น strap line */
  subtitle?: string
  description?: ReactNode
  /** badge/path ขวาสุด */
  meta?: ReactNode
  className?: string
}) {
  const hasContent = !!subtitle || !!description || !!meta || !!icon
  if (!hasContent) return null
  return (
    <header
      role="banner"
      aria-label={titleTooltip ?? title}
      className={cn(
        'relative overflow-hidden rounded-sm border border-vscode-border bg-vscode-sidebar/45',
        className
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-vscode-focus/0 via-vscode-focus/60 to-violet-500/40"
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        {icon ? (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-vscode-focus/25 to-violet-500/20 text-vscode-fg-bright"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {subtitle ? <p className="text-[12px] font-medium text-vscode-fg">{subtitle}</p> : null}
          {description ? (
            <div className={cn('text-[11px] leading-snug text-vscode-fg-dim', subtitle ? 'mt-0.5' : '')}>
              {description}
            </div>
          ) : null}
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </header>
  )
}
