import { cn } from './utils/cn'

/** ธีมเทา IDE (header / workspace): ดู `hubChrome` + สี `vscode.*` ใน tailwind ของแอป */

/** legacy alias: ใช้ได้ทั้งแอป แต่ปรับฐานให้เป็นโทน VS Code เหลี่ยม */
export function macInput(...extra: (string | undefined | false)[]) {
  return cn(
    'w-full rounded-sm border border-vscode-border bg-vscode-input px-2.5 py-1.5 text-[13px] text-vscode-fg outline-none transition-[box-shadow,border-color,background-color]',
    'placeholder:text-vscode-muted focus:border-vscode-focus focus:bg-vscode-input focus:ring-1 focus:ring-vscode-focus/35',
    'disabled:cursor-not-allowed disabled:opacity-50',
    ...extra.filter(Boolean)
  )
}

/** legacy alias: ปุ่มรองแบบ VS Code เหลี่ยม */
export function macButtonSecondary(...extra: (string | undefined | false)[]) {
  return cn(
    'inline-flex items-center justify-center rounded-sm border border-vscode-border bg-vscode-button px-3 py-1.5 text-[12px] font-medium text-vscode-fg',
    'transition-colors hover:bg-vscode-list-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focus/35',
    'disabled:pointer-events-none disabled:opacity-45',
    ...extra.filter(Boolean)
  )
}
