import { cn, hubSettingsInputClass } from '@shared/ui'
import { Sparkles, Wand2 } from 'lucide-react'
import type * as fabric from 'fabric'
import {
  BLEND_MODE_OPTIONS,
  type InkLayerKind,
} from '../coverEditorTypes'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { FieldLabel, IconBtnSm, InspectorSection, SliderRow, SubGroup } from './InspectorSection'

export function AdjustmentsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const {
    busy,
    selectedObject,
    adjustments,
    updateAdjustments,
    resetAdjustments,
  } = useCoverEditorCtx()

  const selectedKind = selectedObject
    ? ((selectedObject as fabric.Object & { inkideaLayerKind?: InkLayerKind }).inkideaLayerKind)
    : undefined

  const empty = !selectedObject
  const isImage = selectedKind === 'image' || selectedKind === 'background'

  return (
    <InspectorSection
      id="sect-adjust"
      title="ปรับแต่งภาพ"
      icon={<Wand2 className="h-3 w-3" aria-hidden />}
      open={open}
      onToggle={onToggle}
      actions={
        !empty ? (
          <IconBtnSm title="รีเซ็ตการปรับแต่งทั้งหมด" disabled={busy} onClick={resetAdjustments}>
            <span className="text-[14px] leading-none">↺</span>
          </IconBtnSm>
        ) : null
      }
    >
      {empty ? (
        <div className="py-2 text-[12px] text-vscode-muted">เลือกเลเยอร์เพื่อปรับแต่ง</div>
      ) : null}

      {!empty ? (
        <div className="space-y-4">
          {isImage ? (
            <SubGroup title="ฟิลเตอร์ภาพ">
              <SliderRow label="เบลอ (Blur)"
                value={adjustments.blur} min={0} max={0.2} step={0.005}
                display={`${Math.round(adjustments.blur * 500)}%`}
                disabled={busy}
                onChange={(v) => updateAdjustments({ blur: v })}
                onReset={() => updateAdjustments({ blur: 0 })}
              />
              <SliderRow label="ความสว่าง"
                value={adjustments.brightness} min={-1} max={1} step={0.01}
                display={adjustments.brightness >= 0 ? `+${(adjustments.brightness * 100).toFixed(0)}` : `${(adjustments.brightness * 100).toFixed(0)}`}
                disabled={busy}
                onChange={(v) => updateAdjustments({ brightness: v })}
                onReset={() => updateAdjustments({ brightness: 0 })}
              />
              <SliderRow label="คอนทราสต์"
                value={adjustments.contrast} min={-1} max={1} step={0.01}
                display={adjustments.contrast >= 0 ? `+${(adjustments.contrast * 100).toFixed(0)}` : `${(adjustments.contrast * 100).toFixed(0)}`}
                disabled={busy}
                onChange={(v) => updateAdjustments({ contrast: v })}
                onReset={() => updateAdjustments({ contrast: 0 })}
              />
              <SliderRow label="ความอิ่มสี"
                value={adjustments.saturation} min={-1} max={1} step={0.01}
                display={adjustments.saturation >= 0 ? `+${(adjustments.saturation * 100).toFixed(0)}` : `${(adjustments.saturation * 100).toFixed(0)}`}
                disabled={busy}
                onChange={(v) => updateAdjustments({ saturation: v })}
                onReset={() => updateAdjustments({ saturation: 0 })}
              />
              <SliderRow label="โทนสี (Hue)"
                value={adjustments.hue} min={-1} max={1} step={0.01}
                display={`${Math.round(adjustments.hue * 180)}°`}
                disabled={busy}
                onChange={(v) => updateAdjustments({ hue: v })}
                onReset={() => updateAdjustments({ hue: 0 })}
              />
            </SubGroup>
          ) : (
            <SubGroup title="ฟิลเตอร์ภาพ">
              <div className="rounded-sm border border-vscode-border bg-vscode-editor px-2.5 py-2 text-[11px] text-vscode-muted">
                ฟิลเตอร์ภาพใช้กับเลเยอร์ภาพหรือพื้นหลังเท่านั้น
              </div>
            </SubGroup>
          )}

          <SubGroup title="โอเวอร์เลย์สี">
            <div className="grid grid-cols-[1fr_56px] gap-2">
              <SliderRow label="ความเข้ม"
                value={adjustments.overlayAlpha} min={0} max={1} step={0.01}
                display={`${Math.round(adjustments.overlayAlpha * 100)}%`}
                disabled={busy || !isImage}
                onChange={(v) => updateAdjustments({ overlayAlpha: v })}
                onReset={() => updateAdjustments({ overlayAlpha: 0 })}
              />
              <label className="block">
                <FieldLabel>สี</FieldLabel>
                <input type="color"
                  value={adjustments.overlayColor}
                  onChange={(e) => updateAdjustments({ overlayColor: e.target.value })}
                  disabled={busy || !isImage}
                  className={cn(hubSettingsInputClass, 'p-1')} />
              </label>
            </div>
          </SubGroup>

          <SubGroup title="เงา / Soft Glow">
            <div className="grid grid-cols-[1fr_56px] gap-2">
              <SliderRow label="ความฟุ้ง (px)"
                value={adjustments.shadowBlur} min={0} max={120} step={1}
                display={`${Math.round(adjustments.shadowBlur)}px`}
                disabled={busy}
                onChange={(v) => updateAdjustments({ shadowBlur: v })}
                onReset={() => updateAdjustments({ shadowBlur: 0 })}
              />
              <label className="block">
                <FieldLabel>สี</FieldLabel>
                <input type="color"
                  value={adjustments.shadowColor}
                  onChange={(e) => updateAdjustments({ shadowColor: e.target.value })}
                  disabled={busy}
                  className={cn(hubSettingsInputClass, 'p-1')} />
              </label>
            </div>
            {!isImage ? (
              <p className="text-[11px] text-vscode-muted">
                ใช้สำหรับเบลอเลเยอร์ข้อความ/รูปทรง (ฟุ้งรอบขอบ)
              </p>
            ) : null}
          </SubGroup>

          <SubGroup title="โหมดผสม (Blend)">
            <select
              value={adjustments.blendMode}
              onChange={(e) => updateAdjustments({ blendMode: e.target.value as typeof adjustments.blendMode })}
              disabled={busy}
              className={hubSettingsInputClass}
            >
              {BLEND_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </SubGroup>

          <button
            type="button"
            title="ล้างการปรับแต่งทั้งหมด"
            onClick={resetAdjustments}
            disabled={busy}
            className={cn(
              'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-sm border border-vscode-border px-3 text-[12px] font-medium text-vscode-fg-dim',
              'transition-colors hover:bg-vscode-list-hover hover:text-vscode-fg disabled:opacity-40'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            ล้างการปรับแต่งทั้งหมด
          </button>
        </div>
      ) : null}
    </InspectorSection>
  )
}
