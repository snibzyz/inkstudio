import { BrandLogo } from './BrandLogo'
import { cn } from '../utils/cn'

export type HubIdeWatermarkShortcut = { label: string; keys: string[] }

const defaultShortcuts: HubIdeWatermarkShortcut[] = [
  { label: 'Explorer', keys: ['Ctrl', 'Shift', 'E'] },
  { label: 'ค้นหาในโปรเจกต์', keys: ['Ctrl', 'Shift', 'F'] },
  { label: 'สมาร์ทคัดลอก', keys: ['Ctrl', 'Shift', 'L'] },
  { label: 'การตั้งค่า', keys: ['Ctrl', ','] },
  { label: 'ซ่อน/แสดงแถบข้าง', keys: ['Ctrl', 'B'] },
  { label: 'ปิดแท็บ', keys: ['Ctrl', 'W'] },
  { label: 'บันทึก', keys: ['Ctrl', 'S'] },
]

function KeyCap({ children }: { children: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-[3px]',
        'border border-[#3c3c3c] bg-[#2d2d2d] px-1 text-[10px] font-medium tabular-nums text-vscode-muted',
        'shadow-[inset_0_-1px_0_rgba(0,0,0,0.35)]'
      )}
    >
      {children}
    </span>
  )
}

export function HubIdeEditorWatermark({
  className,
  title = 'ยังไม่มีไฟล์เปิด',
  hint,
  shortcuts = defaultShortcuts,
}: {
  className?: string
  title?: string
  hint?: string
  shortcuts?: HubIdeWatermarkShortcut[]
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[160px] flex-col items-center justify-center gap-6 px-6 py-8 text-center',
        className
      )}
    >
      <div className="editor-group-watermark flex flex-col items-center gap-4">
        <div className="letterpress select-none opacity-[0.22] grayscale contrast-125">
          <BrandLogo size={112} className="rounded-2xl" />
        </div>
        <div className="max-w-md space-y-1">
          <p className="text-[15px] font-medium text-vscode-fg/80">{title}</p>
          {hint ? <p className="text-[12px] leading-relaxed text-vscode-muted">{hint}</p> : null}
        </div>
        <div className="shortcuts w-full max-w-sm">
          <div className="watermark-box grid gap-2 text-left">
            {shortcuts.map((row) => (
              <dl
                key={row.label}
                className="watermark-item m-0 grid grid-cols-[1fr_auto] items-center gap-3 text-[12px]"
              >
                <dt className="m-0 font-medium text-vscode-fg/75">{row.label}</dt>
                <dd className="m-0 flex flex-wrap items-center justify-end gap-0.5">
                  {row.keys.map((k, i) => (
                    <span key={`${row.label}-${k}-${i}`} className="inline-flex items-center gap-0.5">
                      {i > 0 ? (
                        <span className="select-none text-[10px] text-vscode-muted/80" aria-hidden>
                          +
                        </span>
                      ) : null}
                      <KeyCap>{k}</KeyCap>
                    </span>
                  ))}
                </dd>
              </dl>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
