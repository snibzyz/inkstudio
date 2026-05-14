import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { TONE_ICON, type HubSettingsTone } from './tones'

export function HubSettingsSection({
  icon,
  title,
  description,
  action,
  step,
  tone = 'neutral',
  children,
  className,
  bodyClassName,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  step?: ReactNode
  tone?: HubSettingsTone
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div className={cn(className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-vscode-border/50 pb-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {step !== undefined && step !== null ? (
            <span className="rounded-sm bg-vscode-focus/15 px-1.5 py-px text-[10px] font-semibold tabular-nums text-vscode-focus">
              {step}
            </span>
          ) : null}
          {icon ? (
            <span className={cn('flex h-3 w-3 shrink-0 items-center', TONE_ICON[tone])} aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.05em] text-vscode-muted">
            {title}
          </span>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="mb-2 text-[11px] leading-relaxed text-vscode-fg-dim">{description}</p>
      ) : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </div>
  )
}
