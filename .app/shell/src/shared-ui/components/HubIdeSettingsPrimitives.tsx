import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

export function HubIdeSettingsDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn('text-[12px] leading-relaxed text-vscode-fg-dim', className)}>{children}</p>
}

export function HubIdeSettingsHeader({
  title,
  titleTooltip,
  description,
  className,
}: {
  title: string
  titleTooltip?: string
  description?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-sm border border-vscode-border bg-vscode-sidebar/45 px-5 py-5 shadow-none',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-vscode-border/80" aria-hidden="true" />
      <div className="relative max-w-3xl">
        <h1
          className="text-[20px] font-semibold tracking-[-0.01em] text-vscode-fg-bright sm:text-[22px]"
          title={titleTooltip}
        >
          {title}
        </h1>
        {description ? <HubIdeSettingsDescription className="mt-2">{description}</HubIdeSettingsDescription> : null}
      </div>
    </header>
  )
}

export function HubIdeSettingsCard({
  title,
  titleAs: TitleTag = 'h2',
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode
  titleAs?: 'h2' | 'h3' | 'div'
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <article
      className={cn(
        'overflow-hidden rounded-sm border border-vscode-border bg-vscode-sidebar/35 shadow-none',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-vscode-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <TitleTag className="text-[13px] font-semibold tracking-normal text-vscode-fg-bright">{title}</TitleTag>
          {description ? <HubIdeSettingsDescription className="mt-1.5 text-[11px]">{description}</HubIdeSettingsDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn('px-4 py-4', bodyClassName)}>{children}</div>
    </article>
  )
}

export function HubIdeSettingsField({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vscode-muted">{label}</div>
      {children}
    </div>
  )
}

export const hubIdeSettingsInputClass =
  'h-9 w-full rounded-sm border border-vscode-border bg-vscode-input px-2.5 text-[12px] text-vscode-fg outline-none transition-[border-color,box-shadow,background-color] placeholder:text-vscode-muted focus:border-vscode-focus focus:bg-vscode-input focus:ring-1 focus:ring-vscode-focus/35 read-only:cursor-default read-only:text-vscode-fg-dim disabled:cursor-not-allowed disabled:opacity-50'

export const HubIdeSettingsInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function HubIdeSettingsInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn(hubIdeSettingsInputClass, className)} {...props} />
  }
)

type HubIdeSettingsButtonTone = 'primary' | 'secondary' | 'danger'

export function HubIdeSettingsButton({
  tone = 'secondary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: HubIdeSettingsButtonTone
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-vscode-focus bg-vscode-focus text-white hover:border-vscode-focus hover:bg-[#2493ff]'
      : tone === 'danger'
        ? 'border-[#f14c4c]/35 bg-[#5a1d1d]/25 text-[#ffb4b4] hover:border-[#f14c4c]/55 hover:bg-[#5a1d1d]/45'
        : 'border-vscode-border bg-vscode-button text-vscode-fg hover:border-vscode-border hover:bg-vscode-list-hover'

  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-9 items-center justify-center rounded-sm border px-3 text-[12px] font-medium tracking-normal shadow-none transition-colors focus:outline-none focus:ring-1 focus:ring-vscode-focus/35 disabled:cursor-not-allowed disabled:opacity-45',
        toneClass,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function HubIdeSettingsActionRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex flex-wrap items-center gap-2.5', className)}>{children}</div>
}
