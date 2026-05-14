import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '../../utils/cn'
import { TONE_ICON, type HubSettingsTone } from './tones'

export function HubSettingsField({
  label,
  hint,
  htmlFor,
  required,
  children,
  className,
}: {
  label: ReactNode
  /** คำอธิบาย — แสดงเป็น tooltip ที่ไอคอน ? ข้าง label (ไม่แสดงเป็นข้อความใต้ฟิลด์) */
  hint?: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-vscode-muted"
      >
        <span>{label}</span>
        {required ? <span className="text-rose-400" aria-hidden>*</span> : null}
        {hint ? (
          <span
            tabIndex={0}
            role="img"
            aria-label={hint}
            title={hint}
            className="ml-0.5 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-vscode-border bg-vscode-input/40 text-[9px] font-bold text-vscode-muted hover:border-vscode-focus/60 hover:text-vscode-fg"
          >
            ?
          </span>
        ) : null}
      </label>
      {children}
    </div>
  )
}

export const hubSettingsInputClass =
  'h-8 w-full rounded-sm border border-vscode-border bg-vscode-input px-2.5 text-[12px] text-vscode-fg outline-none transition-[border-color,box-shadow,background-color] placeholder:text-vscode-muted focus:border-vscode-focus focus:ring-1 focus:ring-vscode-focus/35 read-only:cursor-default read-only:text-vscode-fg-dim disabled:cursor-not-allowed disabled:opacity-50'

export const HubSettingsInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function HubSettingsInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(hubSettingsInputClass, className)} {...props} />
  }
)

export function HubSettingsCheckRow({
  label,
  hint,
  checked,
  onChange,
  tone = 'info',
  disabled = false,
  icon,
  className,
}: {
  label: ReactNode
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  tone?: HubSettingsTone
  disabled?: boolean
  icon?: ReactNode
  className?: string
}) {
  return (
    <label
      title={hint}
      className={cn(
        'flex h-8 items-center gap-2 rounded-sm px-2 text-[12px] transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-vscode-list-hover',
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 accent-vscode-focus"
      />
      {icon ? (
        <span
          className={cn('flex h-3.5 w-3.5 shrink-0', checked && !disabled ? TONE_ICON[tone] : 'text-vscode-muted')}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <span className="flex-1 select-none font-medium text-vscode-fg">{label}</span>
    </label>
  )
}

export type HubSettingsToggleOption<V extends string> = {
  value: V
  label: string
  hint?: string
  icon?: ReactNode
  /** Tailwind gradient classes — เช่น "from-sky-500/40 to-violet-500/40" */
  gradient?: string
  disabled?: boolean
}

export function HubSettingsToggleGroup<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: V
  options: HubSettingsToggleOption<V>[]
  onChange: (next: V) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'grid gap-1 rounded-sm border border-vscode-border/70 bg-vscode-input/30 p-1',
        options.length === 2 ? 'grid-cols-2' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-4',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded-sm text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? cn(
                    'bg-gradient-to-r text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
                    opt.gradient ?? 'from-vscode-focus/55 to-violet-500/45'
                  )
                : 'text-vscode-muted hover:bg-vscode-list-hover hover:text-vscode-fg'
            )}
          >
            {opt.icon ? <span className="h-3.5 w-3.5" aria-hidden>{opt.icon}</span> : null}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export type HubSettingsButtonTone =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'success'
  | 'magic'
  | 'danger'

export function HubSettingsButton({
  tone = 'secondary',
  size = 'md',
  icon,
  iconRight,
  gradient = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: HubSettingsButtonTone
  size?: 'sm' | 'md'
  icon?: ReactNode
  iconRight?: ReactNode
  /** เปิด gradient — ใช้เฉพาะปุ่มสำคัญ */
  gradient?: boolean
}) {
  const sizeClass = size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-[12px]'

  const flatTone =
    tone === 'primary'
      ? 'border-vscode-focus bg-vscode-focus text-white hover:bg-[#2493ff]'
      : tone === 'success'
        ? 'border-emerald-600 bg-emerald-700 text-white hover:bg-emerald-600'
        : tone === 'magic'
          ? 'border-violet-600 bg-violet-700 text-white hover:bg-violet-600'
          : tone === 'danger'
            ? 'border-rose-600/55 bg-rose-700/35 text-rose-100 hover:bg-rose-700/55'
            : tone === 'ghost'
              ? 'border-transparent bg-transparent text-vscode-fg hover:bg-vscode-list-hover'
              : 'border-vscode-border bg-vscode-button text-vscode-fg hover:bg-vscode-list-hover'

  const gradientTone =
    tone === 'primary'
      ? 'border-vscode-focus/60 bg-gradient-to-b from-[#1a8fd8] to-vscode-focus text-white hover:from-[#2493ff] hover:to-[#1a8fd8] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
      : tone === 'success'
        ? 'border-emerald-500/55 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:from-emerald-400 hover:to-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
        : tone === 'magic'
          ? 'border-violet-500/55 bg-gradient-to-b from-violet-500 to-violet-700 text-white hover:from-violet-400 hover:to-violet-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
          : tone === 'danger'
            ? 'border-rose-500/55 bg-gradient-to-b from-rose-600 to-rose-800 text-white hover:from-rose-500 hover:to-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
            : flatTone

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-sm border font-medium tracking-normal transition-colors focus:outline-none focus:ring-1 focus:ring-vscode-focus/40 disabled:cursor-not-allowed disabled:opacity-45',
        sizeClass,
        gradient ? gradientTone : flatTone,
        className
      )}
      {...props}
    >
      {icon ? <span className="flex h-3.5 w-3.5 shrink-0 items-center" aria-hidden>{icon}</span> : null}
      <span className="truncate">{children}</span>
      {iconRight ? <span className="flex h-3.5 w-3.5 shrink-0 items-center" aria-hidden>{iconRight}</span> : null}
    </button>
  )
}

export function HubSettingsActionRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
