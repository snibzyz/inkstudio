import { cn } from '../utils/cn'

export interface AppTabItem {
  key: string
  label: string
}

interface AppTabsProps {
  items: AppTabItem[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
  /** mac = INKIDEA Hub (เส้นแบ่งนุ่ม), glass = ตัวอย่างเดิม */
  variant?: 'mac' | 'glass'
  /** ป้ายสำหรับ screen reader */
  'aria-label'?: string
}

export function AppTabs({ items, activeKey, onChange, className, variant = 'mac', 'aria-label': ariaLabel }: AppTabsProps) {
  if (variant === 'glass') {
    return (
      <div
        className={cn(
          'inline-flex w-full flex-wrap gap-1 rounded-sm border border-vscode-border bg-vscode-sidebar/40 p-1 shadow-none',
          className
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const active = item.key === activeKey
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.key)}
              className={cn(
                'rounded-sm px-3 py-2 text-[12px] font-medium transition-colors',
                active
                  ? 'bg-vscode-list-active text-vscode-fg-bright'
                  : 'text-vscode-muted hover:bg-vscode-list-hover hover:text-vscode-fg'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full flex-wrap gap-1 rounded-sm border border-vscode-border bg-vscode-sidebar/40 p-1 shadow-none',
        className
      )}
      role="tablist"
      aria-label={ariaLabel ?? 'แท็บ'}
    >
      {items.map((item) => {
        const active = item.key === activeKey
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'min-h-8 rounded-sm px-3 py-1.5 text-left text-[12px] font-medium outline-none transition-colors',
              'focus-visible:ring-1 focus-visible:ring-vscode-focus/40',
              active
                ? 'bg-vscode-list-active text-vscode-fg-bright'
                : 'text-vscode-muted hover:bg-vscode-list-hover hover:text-vscode-fg'
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
