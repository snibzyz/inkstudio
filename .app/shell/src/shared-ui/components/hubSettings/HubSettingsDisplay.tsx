import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import {
  TONE_BADGE,
  TONE_BG_SOFT,
  TONE_BORDER,
  TONE_ICON,
  TONE_TEXT,
  type HubSettingsTone,
} from './tones'
import { HubSettingsButton } from './HubSettingsControls'

export function HubSettingsStat({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  icon?: ReactNode
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: HubSettingsTone
  className?: string
}) {
  return (
    <div className={cn('rounded-sm border px-2.5 py-2', TONE_BORDER[tone], TONE_BG_SOFT[tone], className)}>
      <div className="flex items-center gap-1.5">
        {icon ? (
          <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center', TONE_ICON[tone])} aria-hidden>
            {icon}
          </span>
        ) : null}
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-vscode-muted">{label}</p>
      </div>
      <p className={cn('mt-1 text-[18px] font-semibold leading-tight', TONE_TEXT[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-vscode-fg-dim">{hint}</p> : null}
    </div>
  )
}

export function HubSettingsStatGrid({
  cols = 4,
  children,
  className,
}: {
  cols?: 2 | 3 | 4 | 5
  children: ReactNode
  className?: string
}) {
  const colClass =
    cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : cols === 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'
  return <div className={cn('grid gap-2.5', colClass, className)}>{children}</div>
}

export function HubSettingsBadge({
  tone = 'neutral',
  icon,
  className,
  children,
}: {
  tone?: HubSettingsTone
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold',
        TONE_BADGE[tone],
        className
      )}
    >
      {icon ? <span className="h-3 w-3 shrink-0" aria-hidden>{icon}</span> : null}
      {children}
    </span>
  )
}

export function HubSettingsAlert({
  tone = 'info',
  icon,
  title,
  children,
  className,
}: {
  tone?: HubSettingsTone
  icon?: ReactNode
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-sm border px-3 py-2 text-[11px] leading-relaxed',
        TONE_BORDER[tone],
        TONE_BG_SOFT[tone],
        className
      )}
    >
      {icon ? (
        <span className={cn('mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center', TONE_ICON[tone])} aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className={cn('text-[12px] font-semibold', TONE_TEXT[tone])}>{title}</p> : null}
        {children ? <div className={cn('text-vscode-fg-dim', title ? 'mt-0.5' : '')}>{children}</div> : null}
      </div>
    </div>
  )
}

export function HubSettingsPathRow({
  label,
  value,
  icon,
  action,
}: {
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  action?: ReactNode
}) {
  const valueStr = typeof value === 'string' ? value : undefined
  return (
    <div
      title={valueStr}
      className="flex min-h-8 flex-wrap items-center gap-2"
    >
      {icon ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center text-vscode-muted" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-[72px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-vscode-muted">
        {label}
      </span>
      <code
        title={valueStr}
        className="flex-1 break-all rounded-sm bg-vscode-sidebar/80 px-1.5 py-1 font-mono text-[12px] text-vscode-fg"
      >
        {value}
      </code>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  )
}

/**
 * แถวเลือกไฟล์ในหน้าตั้งค่า (ใช้ร่วมกันใน คำศัพท์ / สำนวน / พร้อมพ์)
 * — checkbox ซ้าย + icon + ชื่อไฟล์ + path ย่อ — ใช้ font Tahoma (ระบบ)
 *   ไม่ใช้ monospace เพื่อให้สอดคล้องกับ UI ทั้งระบบ
 */
export function HubSettingsFileRow({
  id,
  name,
  path,
  checked,
  onChange,
  onOpen,
  icon,
  tone = 'info',
  className,
}: {
  id?: string
  name: ReactNode
  path?: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  /** เมื่อกำหนด: คลิกที่ชื่อไฟล์จะเปิดไฟล์ (ไม่กระทบ checkbox); ถ้าไม่กำหนด: ทั้งแถวเป็น label toggle เหมือนเดิม */
  onOpen?: () => void
  icon?: ReactNode
  tone?: HubSettingsTone
  className?: string
}) {
  const rowClass = cn(
    'group flex items-start gap-2 rounded-sm border px-2.5 py-1.5 transition-colors',
    checked
      ? cn(TONE_BORDER[tone], TONE_BG_SOFT[tone])
      : 'border-vscode-border/60 bg-vscode-input/15 hover:border-vscode-border hover:bg-vscode-list-hover',
    onOpen ? '' : 'cursor-pointer',
    className
  )
  const checkbox = (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-vscode-focus"
      aria-label="เลือกไฟล์"
    />
  )
  const iconNode = icon ? (
    <span className={cn('mt-0.5 flex h-3.5 w-3.5 shrink-0', checked ? TONE_ICON[tone] : 'text-vscode-muted')} aria-hidden>
      {icon}
    </span>
  ) : null
  const nameBlock = (
    <span className="min-w-0 flex-1 leading-snug">
      <span className={cn('block truncate text-[12px] font-medium', checked ? 'text-vscode-fg-bright' : 'text-vscode-fg')}>
        {name}
      </span>
      {path ? <span className="mt-0.5 block break-all text-[10px] text-vscode-muted">{path}</span> : null}
    </span>
  )

  if (onOpen) {
    return (
      <div className={rowClass}>
        {checkbox}
        {iconNode}
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={onOpen}
          onDoubleClick={onOpen}
          title={typeof name === 'string' ? `เปิด ${name}` : 'เปิดไฟล์'}
        >
          {nameBlock}
        </button>
      </div>
    )
  }

  return (
    <label htmlFor={id} className={cn(rowClass, 'cursor-pointer')}>
      {checkbox}
      {iconNode}
      {nameBlock}
    </label>
  )
}

/**
 * Header ของรายการเลือกไฟล์ — ป้ายซ้าย + ปุ่ม "ทั้งหมด/ไม่เลือก/ค่าเริ่มต้น" ขวา
 * ใช้คู่กับ HubSettingsFileRow
 */
export function HubSettingsFilePickerHeader({
  selectedCount,
  totalCount,
  onSelectAll,
  onSelectNone,
  onReset,
  hint,
  tone = 'info',
}: {
  selectedCount: number
  totalCount: number
  onSelectAll?: () => void
  onSelectNone?: () => void
  onReset?: () => void
  hint?: ReactNode
  tone?: HubSettingsTone
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2',
        TONE_BORDER[tone],
        TONE_BG_SOFT[tone]
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px]">
        <span className="text-vscode-fg-dim">เลือกแล้ว</span>
        <HubSettingsBadge tone={tone}>
          {selectedCount}/{totalCount}
        </HubSettingsBadge>
        {hint ? <span className="ml-1 truncate text-[11px] text-vscode-muted">{hint}</span> : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1">
        {onSelectAll ? (
          <HubSettingsButton size="sm" onClick={onSelectAll} title="ติ๊กครบทุกไฟล์">
            ทั้งหมด
          </HubSettingsButton>
        ) : null}
        {onSelectNone ? (
          <HubSettingsButton size="sm" onClick={onSelectNone} title="ไม่เลือก">
            ล้าง
          </HubSettingsButton>
        ) : null}
        {onReset ? (
          <HubSettingsButton size="sm" onClick={onReset} title="กลับไปใช้ทุกไฟล์ในโฟลเดอร์">
            ค่าเริ่มต้น
          </HubSettingsButton>
        ) : null}
      </div>
    </div>
  )
}

export function HubSettingsEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-vscode-border/70 bg-vscode-input/10 px-5 py-8 text-center',
        className
      )}
    >
      {icon ? <span className="flex h-7 w-7 items-center justify-center text-vscode-muted/80" aria-hidden>{icon}</span> : null}
      <p className="text-[12px] font-semibold text-vscode-fg">{title}</p>
      {description ? <p className="max-w-md text-[11px] leading-relaxed text-vscode-fg-dim">{description}</p> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  )
}
