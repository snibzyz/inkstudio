import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../utils/cn'

/** พื้นที่ทำงานหลักของ Hub — โทน VS Code / editor */
export function IdeWorkspaceSurface({ className, children, ...rest }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden bg-vscode-editor text-vscode-fg', className)}
      {...rest}
    >
      {children}
    </section>
  )
}
