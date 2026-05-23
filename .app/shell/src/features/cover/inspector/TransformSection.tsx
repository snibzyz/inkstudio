import { Codicon, hubSettingsInputClass } from '@shared/ui'
import { Move3D, RotateCw } from 'lucide-react'
import type * as fabric from 'fabric'
import type { InkLayerKind } from '../coverEditorTypes'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { FieldLabel, IconBtnSm, InspectorSection } from './InspectorSection'

export function TransformSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const {
    busy,
    selectedObject,
    selectedLayerId,
    layerAngleDeg,
    setLayerAngleDeg,
    applyLayerAngle,
    resetSelectedLayerTransform,
    deleteSelectedLayer,
    bringForwardSelected,
    sendBackwardSelected,
  } = useCoverEditorCtx()

  const selectedKind = selectedObject
    ? ((selectedObject as fabric.Object & { inkideaLayerKind?: InkLayerKind }).inkideaLayerKind)
    : undefined
  const isNonBg = selectedKind && selectedKind !== 'background'

  return (
    <InspectorSection
      id="sect-transform"
      title="การจัดวาง"
      icon={<Move3D className="h-3 w-3" aria-hidden />}
      open={open}
      onToggle={onToggle}
      actions={
        isNonBg ? (
          <>
            <IconBtnSm title="รีเซ็ตตำแหน่ง/มุม/ขนาด" disabled={busy || !selectedLayerId} onClick={resetSelectedLayerTransform}>
              <Codicon name="discard" size={14} />
            </IconBtnSm>
            <IconBtnSm title="ลบเลเยอร์" disabled={busy || !selectedLayerId} onClick={deleteSelectedLayer}
              className="hover:bg-vscode-error/15 hover:text-vscode-error">
              <Codicon name="trash" size={14} />
            </IconBtnSm>
          </>
        ) : null
      }
    >
      {!selectedObject ? (
        <div className="py-2 text-[12px] text-vscode-muted">เลือกเลเยอร์เพื่อจัดวาง</div>
      ) : null}

      {isNonBg ? (
        <div className="space-y-3">
          <div>
            <FieldLabel>มุม (องศา)</FieldLabel>
            <div className="flex items-center gap-2">
              <RotateCw className="h-3.5 w-3.5 shrink-0 text-vscode-muted" aria-hidden />
              <input
                type="number" min={-180} max={180} step={1} value={layerAngleDeg}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isNaN(v)) return
                  const clamped = Math.min(180, Math.max(-180, v))
                  setLayerAngleDeg(clamped)
                  applyLayerAngle(clamped)
                }}
                disabled={busy}
                className={`${hubSettingsInputClass} w-16 tabular-nums`}
              />
              <input
                type="range" min={-180} max={180} step={1} value={layerAngleDeg}
                onChange={(e) => {
                  const v = Number(e.target.valueAsNumber)
                  setLayerAngleDeg(v)
                  applyLayerAngle(v)
                }}
                disabled={busy}
                className="min-w-[80px] flex-1 accent-vscode-focus disabled:opacity-40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              title="นำเลเยอร์ขึ้นหน้า"
              disabled={busy || !selectedLayerId}
              onClick={bringForwardSelected}
              className="h-8 rounded-sm border border-vscode-border px-2.5 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg disabled:opacity-40"
            >
              นำขึ้นหน้า
            </button>
            <button
              type="button"
              title="ส่งเลเยอร์ลงหลัง"
              disabled={busy || !selectedLayerId}
              onClick={sendBackwardSelected}
              className="h-8 rounded-sm border border-vscode-border px-2.5 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg disabled:opacity-40"
            >
              ส่งไปหลัง
            </button>
          </div>
        </div>
      ) : null}

      {selectedKind === 'background' && selectedObject ? (
        <p className="text-[11px] text-vscode-muted">
          พื้นหลังจัดวางอัตโนมัติให้เต็มแคนวาส ปรับขนาด/ตำแหน่งบนแคนวาสได้โดยตรง
        </p>
      ) : null}
    </InspectorSection>
  )
}
