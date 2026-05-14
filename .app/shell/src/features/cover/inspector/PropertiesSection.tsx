import { cn, HubSettingsCheckRow, hubSettingsInputClass, MacFontSelect } from '@shared/ui'
import {
  AlignCenter, AlignLeft, AlignRight,
  Move,
  Paintbrush,
  SlidersHorizontal,
} from 'lucide-react'
import type * as fabric from 'fabric'
import type { InkLayerKind } from '../coverEditorTypes'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { FieldLabel, InspectorSection, SubGroup } from './InspectorSection'

export function PropertiesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ctx = useCoverEditorCtx()
  const {
    busy,
    selectedObject,
    fontChoices,
    textValue, setTextValue,
    textFontSize, setTextFontSize,
    textFontFamily, setTextFontFamily,
    textFill, setTextFill,
    textOpacity, setTextOpacity,
    textAlign, setTextAlign,
    strokeEnabled, setStrokeEnabled,
    strokeWidth, setStrokeWidth,
    strokeColor, setStrokeColor,
    textStrokeAlign, setTextStrokeAlign,
    fillMode, setFillMode,
    gradientFrom, setGradientFrom,
    gradientTo, setGradientTo,
    gradientDirection, setGradientDirection,
    imageOpacity, setImageOpacity,
    shapeFill, setShapeFill,
    shapeStroke, setShapeStroke,
    shapeStrokeWidth, setShapeStrokeWidth,
    shapeOpacity, setShapeOpacity,
  } = ctx

  const selectedKind = selectedObject
    ? ((selectedObject as fabric.Object & { inkideaLayerKind?: InkLayerKind }).inkideaLayerKind)
    : undefined

  const empty = !selectedObject

  return (
    <InspectorSection
      id="sect-props"
      title="คุณสมบัติ"
      icon={<SlidersHorizontal className="h-3 w-3" aria-hidden />}
      open={open}
      onToggle={onToggle}
    >
      {empty ? (
        <div className="py-2 text-[12px] text-vscode-muted">เลือกเลเยอร์เพื่อปรับคุณสมบัติ</div>
      ) : null}

      {selectedKind === 'text' ? (
        <div className="space-y-4">
          <SubGroup title="ข้อความ">
            <input value={textValue} onChange={(e) => setTextValue(e.target.value)} disabled={busy} className={hubSettingsInputClass} />
          </SubGroup>

          <SubGroup title="ฟอนต์">
            <MacFontSelect fonts={fontChoices} value={textFontFamily} onChange={setTextFontFamily} disabled={busy} />
          </SubGroup>

          <SubGroup title="ขนาดและความทึบ">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <FieldLabel>ขนาด (px)</FieldLabel>
                <input type="number" min={12} max={220} step={1} value={textFontSize}
                  onChange={(e) => setTextFontSize(Number(e.target.value))} disabled={busy} className={hubSettingsInputClass} />
              </label>
              <label className="block">
                <FieldLabel>ความทึบ</FieldLabel>
                <input type="number" min={0} max={1} step={0.05} value={textOpacity}
                  onChange={(e) => setTextOpacity(Number(e.target.value))} disabled={busy} className={hubSettingsInputClass} />
              </label>
            </div>
          </SubGroup>

          <SubGroup title="จัดบรรทัด">
            <div className="grid grid-cols-3 gap-1">
              {([
                { v: 'left' as const, Icon: AlignLeft, label: 'ซ้าย' },
                { v: 'center' as const, Icon: AlignCenter, label: 'กลาง' },
                { v: 'right' as const, Icon: AlignRight, label: 'ขวา' },
              ] as const).map(({ v, Icon, label }) => (
                <button key={v} type="button" disabled={busy} title={label} onClick={() => setTextAlign(v)}
                  className={cn(
                    'flex items-center justify-center rounded-sm border py-2 transition-colors',
                    textAlign === v
                      ? 'border-vscode-focus/60 bg-vscode-focus/15 text-vscode-focus'
                      : 'border-vscode-border bg-vscode-editor text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg',
                    busy ? 'opacity-40' : ''
                  )}>
                  <Icon className="h-[14px] w-[14px]" aria-hidden />
                  <span className="sr-only">{label}</span>
                </button>
              ))}
            </div>
          </SubGroup>

          <SubGroup title="สีข้อความ">
            <label className="block">
              <FieldLabel>โหมดสี</FieldLabel>
              <select value={fillMode} onChange={(e) => setFillMode(e.target.value as 'solid' | 'gradient')}
                disabled={busy} className={hubSettingsInputClass}>
                <option value="solid">สีทึบ</option>
                <option value="gradient">ไล่เฉด</option>
              </select>
            </label>

            {fillMode === 'solid' ? (
              <label className="mt-2 block">
                <FieldLabel>สี</FieldLabel>
                <input type="color" value={textFill} onChange={(e) => setTextFill(e.target.value)}
                  disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
              </label>
            ) : (
              <div className="mt-2 space-y-2 rounded-sm border border-vscode-border bg-vscode-editor p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <FieldLabel>สีเริ่ม</FieldLabel>
                    <input type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)}
                      disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
                  </label>
                  <label className="block">
                    <FieldLabel>สีปลาย</FieldLabel>
                    <input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)}
                      disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
                  </label>
                </div>
                <div className="h-7 w-full rounded-sm border border-vscode-border"
                  style={{ background: `linear-gradient(${gradientDirection === 'vertical' ? '180deg' : '90deg'}, ${gradientFrom}, ${gradientTo})` }} />
                <label className="block">
                  <FieldLabel>ทิศทาง</FieldLabel>
                  <select value={gradientDirection}
                    onChange={(e) => setGradientDirection(e.target.value as 'vertical' | 'horizontal')}
                    disabled={busy} className={hubSettingsInputClass}>
                    <option value="vertical">แนวตั้ง ↓</option>
                    <option value="horizontal">แนวนอน →</option>
                  </select>
                </label>
              </div>
            )}
          </SubGroup>

          <SubGroup title="ขอบ (Stroke)">
            <HubSettingsCheckRow
              label="เปิดใช้ขอบ"
              icon={<Paintbrush className="h-3.5 w-3.5" />}
              checked={strokeEnabled}
              onChange={setStrokeEnabled}
              disabled={busy}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <FieldLabel>ความหนา (px)</FieldLabel>
                <input type="number" min={0} max={20} step={0.5} value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  disabled={busy || !strokeEnabled} className={hubSettingsInputClass} />
              </label>
              <label className="block">
                <FieldLabel>สีขอบ</FieldLabel>
                <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)}
                  disabled={busy || !strokeEnabled} className={cn(hubSettingsInputClass, 'p-1')} />
              </label>
            </div>
            <div>
              <FieldLabel>ตำแหน่งขอบ</FieldLabel>
              <div className="grid grid-cols-2 gap-1">
                {([
                  { v: 'outside' as const, label: 'นอก' },
                  { v: 'inside' as const, label: 'ใน' },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button" disabled={busy || !strokeEnabled}
                    onClick={() => setTextStrokeAlign(v)}
                    className={cn(
                      'rounded-sm border py-1.5 text-[11px] font-medium transition-colors',
                      textStrokeAlign === v
                        ? 'border-vscode-focus/60 bg-vscode-focus/15 text-vscode-focus'
                        : 'border-vscode-border bg-vscode-editor text-vscode-fg-dim hover:bg-vscode-list-hover',
                      (busy || !strokeEnabled) ? 'opacity-40' : ''
                    )}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </SubGroup>
        </div>
      ) : null}

      {selectedKind === 'image' || selectedKind === 'background' ? (
        <SubGroup title="ภาพ">
          <label className="block">
            <FieldLabel>ความทึบ</FieldLabel>
            <input type="number" min={0} max={1} step={0.05} value={imageOpacity}
              onChange={(e) => setImageOpacity(Number(e.target.value))}
              disabled={busy} className={hubSettingsInputClass} />
          </label>
          <p className="flex items-center gap-1.5 text-[11px] text-vscode-muted">
            <Move className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            ลาก · ย่อขยาย · หมุน บนแคนวาส
          </p>
        </SubGroup>
      ) : null}

      {selectedKind === 'shape' ? (
        <SubGroup title="รูปทรง">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <FieldLabel>สีเติม</FieldLabel>
              <input type="color" value={shapeFill} onChange={(e) => setShapeFill(e.target.value)}
                disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
            </label>
            <label className="block">
              <FieldLabel>ความทึบ</FieldLabel>
              <input type="number" min={0} max={1} step={0.05} value={shapeOpacity}
                onChange={(e) => setShapeOpacity(Number(e.target.value))}
                disabled={busy} className={hubSettingsInputClass} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <FieldLabel>ความหนาขอบ</FieldLabel>
              <input type="number" min={0} max={40} step={1} value={shapeStrokeWidth}
                onChange={(e) => setShapeStrokeWidth(Number(e.target.value))}
                disabled={busy} className={hubSettingsInputClass} />
            </label>
            <label className="block">
              <FieldLabel>สีขอบ</FieldLabel>
              <input type="color" value={shapeStroke} onChange={(e) => setShapeStroke(e.target.value)}
                disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
            </label>
          </div>
        </SubGroup>
      ) : null}
    </InspectorSection>
  )
}
