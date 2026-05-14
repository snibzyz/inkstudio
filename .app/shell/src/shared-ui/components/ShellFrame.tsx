import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface ShellFrameProps {
  children: ReactNode
  className?: string
}

/** macOS-style shell: system grays, subtle top light (like desktop wallpaper bleed). */
export function ShellFrame({ children, className }: ShellFrameProps) {
  return (
    <div
      className={cn(
        'min-h-screen w-full text-vscode-fg antialiased',
        'bg-[linear-gradient(180deg,rgb(45_45_46)_0%,rgb(30_30_30)_45%,rgb(26_26_26)_100%)]',
        className
      )}
    >
      {children}
    </div>
  )
}
