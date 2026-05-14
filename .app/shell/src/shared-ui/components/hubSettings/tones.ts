/**
 * Shared tone tokens สำหรับ HubSettings primitives ทั้งชุด
 */

export type HubSettingsTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'magic'

export const TONE_BORDER: Record<HubSettingsTone, string> = {
  neutral: 'border-vscode-border/70',
  info: 'border-sky-500/35',
  success: 'border-emerald-500/35',
  warning: 'border-amber-500/35',
  danger: 'border-rose-500/35',
  magic: 'border-violet-500/35',
}

export const TONE_BG_SOFT: Record<HubSettingsTone, string> = {
  neutral: 'bg-vscode-input/25',
  info: 'bg-sky-500/[0.06]',
  success: 'bg-emerald-500/[0.06]',
  warning: 'bg-amber-500/[0.06]',
  danger: 'bg-rose-500/[0.06]',
  magic: 'bg-violet-500/[0.06]',
}

export const TONE_TEXT: Record<HubSettingsTone, string> = {
  neutral: 'text-vscode-fg',
  info: 'text-sky-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
  magic: 'text-violet-300',
}

export const TONE_ICON: Record<HubSettingsTone, string> = {
  neutral: 'text-vscode-muted',
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-rose-400',
  magic: 'text-violet-400',
}

export const TONE_BADGE: Record<HubSettingsTone, string> = {
  neutral: 'bg-vscode-input/40 text-vscode-fg-dim',
  info: 'bg-sky-500/15 text-sky-300',
  success: 'bg-emerald-500/15 text-emerald-300',
  warning: 'bg-amber-500/15 text-amber-300',
  danger: 'bg-rose-500/15 text-rose-300',
  magic: 'bg-violet-500/15 text-violet-300',
}
