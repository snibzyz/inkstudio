import { cn } from './utils/cn'

/** โซนขั้นตอน (ซ้าย) — VS Code panel style */
export const zoneStep = {
  1: 'border border-vscode-border bg-vscode-surface',
  2: 'border border-vscode-border bg-vscode-surface',
  3: 'border border-vscode-border bg-vscode-surface',
} as const

/** โซนแคนวาส (กลาง) */
export const zoneCanvasShell = 'border border-vscode-border bg-vscode-surface'

/** แถบขวา */
export const zoneRightRail = 'border border-vscode-border bg-vscode-surface'

/** พื้นหลังนอกแคนวาส (pasteboard) — Photoshop gray */
export const zonePasteboard = 'bg-[#3c3c3c]'

export function zoneStepBadge(_step: 1 | 2 | 3) {
  return cn(
    'flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-sm',
    'bg-vscode-accent/25 text-[10px] font-bold tabular-nums text-vscode-focus'
  )
}
