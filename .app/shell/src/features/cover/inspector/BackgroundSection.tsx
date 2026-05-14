import { AppButton, cn, hubSettingsInputClass } from '@shared/ui'
import { ImagePlus, Palette } from 'lucide-react'
import type * as fabric from 'fabric'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { FieldLabel, InspectorSection, SubGroup } from './InspectorSection'

export function BackgroundSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const {
    busy,
    fabricRef,
    backgroundImageIdRef,
    bgMode, setBgMode,
    bgOpacity, setBgOpacity,
    bgFillStyle, setBgFillStyle,
    bgColor, setBgColor,
    bgGradientFrom, setBgGradientFrom,
    bgGradientTo, setBgGradientTo,
    bgGradientDirection, setBgGradientDirection,
    chooseTemplateCoverImageForCrop,
    loadBackgroundImageFromDataUrl,
    clearBackgroundImage,
    syncLayers,
    openCoverCropDialog,
  } = useCoverEditorCtx()

  return (
    <InspectorSection
      id="sect-bg"
      title="พื้นหลัง"
      icon={<Palette className="h-3 w-3" aria-hidden />}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <SubGroup title="รูปพื้นหลัง">
          <div className="grid grid-cols-2 gap-1.5">
            <AppButton
              tone="zinc"
              variant="flat"
              disabled={busy}
              onPress={async () => {
                const dataUrl = await chooseTemplateCoverImageForCrop()
                if (dataUrl) openCoverCropDialog('background', dataUrl, loadBackgroundImageFromDataUrl)
              }}
              className="min-h-8 justify-center text-[11px]">
              <ImagePlus className="mr-1 h-3 w-3 shrink-0" />
              เลือกรูป
            </AppButton>
            <AppButton tone="zinc" variant="flat" disabled={busy} onPress={clearBackgroundImage}
              className="min-h-8 justify-center text-[11px]">
              ล้างรูป
            </AppButton>
          </div>
        </SubGroup>

        <SubGroup title="โหมด">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <FieldLabel>โหมด</FieldLabel>
              <select value={bgMode}
                onChange={(e) => {
                  const next = e.target.value as typeof bgMode
                  setBgMode(next)
                  const c = fabricRef.current
                  if (c && next !== 'image') {
                    const imgId = backgroundImageIdRef.current
                    if (imgId) {
                      const obj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === imgId)
                      if (obj) c.remove(obj)
                    }
                    backgroundImageIdRef.current = null
                    c.requestRenderAll()
                    syncLayers()
                  }
                }}
                disabled={busy} className={hubSettingsInputClass}>
                <option value="color">สี</option>
                <option value="image">รูปภาพ</option>
                <option value="transparent">โปร่งใส</option>
              </select>
            </label>
            <label className="block">
              <FieldLabel>ความทึบ</FieldLabel>
              <input type="number" min={0} max={1} step={0.05} value={bgOpacity}
                onChange={(e) => setBgOpacity(Number(e.target.value))}
                disabled={busy || bgMode !== 'color'} className={hubSettingsInputClass} />
            </label>
          </div>
        </SubGroup>

        {bgMode === 'color' ? (
          <SubGroup title="สี">
            <label className="block">
              <FieldLabel>สไตล์</FieldLabel>
              <select value={bgFillStyle}
                onChange={(e) => setBgFillStyle(e.target.value as 'solid' | 'gradient')}
                disabled={busy} className={hubSettingsInputClass}>
                <option value="solid">สีทึบ</option>
                <option value="gradient">ไล่เฉด</option>
              </select>
            </label>

            {bgFillStyle === 'solid' ? (
              <label className="block">
                <FieldLabel>สีพื้นหลัง</FieldLabel>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                  disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <FieldLabel>สีเริ่ม</FieldLabel>
                    <input type="color" value={bgGradientFrom} onChange={(e) => setBgGradientFrom(e.target.value)}
                      disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
                  </label>
                  <label className="block">
                    <FieldLabel>สีปลาย</FieldLabel>
                    <input type="color" value={bgGradientTo} onChange={(e) => setBgGradientTo(e.target.value)}
                      disabled={busy} className={cn(hubSettingsInputClass, 'p-1')} />
                  </label>
                </div>
                <div className="h-7 w-full rounded-sm border border-vscode-border"
                  style={{ background: `linear-gradient(${bgGradientDirection === 'vertical' ? '180deg' : '90deg'}, ${bgGradientFrom}, ${bgGradientTo})` }} />
                <label className="block">
                  <FieldLabel>ทิศทาง</FieldLabel>
                  <select value={bgGradientDirection}
                    onChange={(e) => setBgGradientDirection(e.target.value as 'vertical' | 'horizontal')}
                    disabled={busy} className={hubSettingsInputClass}>
                    <option value="vertical">แนวตั้ง ↓</option>
                    <option value="horizontal">แนวนอน →</option>
                  </select>
                </label>
              </div>
            )}
          </SubGroup>
        ) : null}
      </div>
    </InspectorSection>
  )
}
