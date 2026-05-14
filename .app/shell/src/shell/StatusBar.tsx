import { Codicon } from '../ui'
import { MODULE_META, useApp } from '../state/useApp'
import { useRender } from '../features/render/useRender'

export function StatusBar() {
  const active = useApp((s) => s.activeModule)
  const meta = MODULE_META[active]
  const renderBusy = useRender((s) => s.busy)
  const renderStatus = useRender((s) => s.status)
  const renderError = useRender((s) => s.error)

  const showRender = active === 'render'

  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-vscode-border bg-vscode-statusbar px-3 text-[12px] text-white">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Codicon name={meta.icon} size={13} />
        {meta.label === 'ปก' ? 'โหมดทำปก' : 'โหมดเรนเดอร์คลิป'}
      </span>

      {showRender && renderBusy ? (
        <span className="inline-flex items-center gap-1.5">
          <Codicon name="loading" size={13} spin />
          {renderStatus || 'กำลังเรนเดอร์...'}
        </span>
      ) : showRender && renderError ? (
        <span className="inline-flex items-center gap-1.5 text-amber-100">
          <Codicon name="warning" size={13} />
          {renderError}
        </span>
      ) : showRender && renderStatus ? (
        <span className="inline-flex items-center gap-1.5">
          <Codicon name="check" size={13} />
          {renderStatus}
        </span>
      ) : (
        <span className="text-white/80">พร้อมใช้งาน</span>
      )}

      <span className="ml-auto text-[11px] text-white/70">
        INKSTUDIO · ตระกูล INK
      </span>
    </footer>
  )
}
