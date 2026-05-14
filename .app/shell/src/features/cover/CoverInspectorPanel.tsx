import { useEffect, useState } from 'react'
import { AppButton, cn, zoneRightRail } from '@shared/ui'
import { ExternalLink, FolderOpen, Save, Upload } from 'lucide-react'
import type * as fabric from 'fabric'
import type { InkLayerKind } from './coverEditorTypes'
import { useCoverEditorCtx } from './CoverEditorContext'
import { UploadDock } from './inspector/UploadDock'
import { LayersSection } from './inspector/LayersSection'
import { PropertiesSection } from './inspector/PropertiesSection'
import { AdjustmentsSection } from './inspector/AdjustmentsSection'
import { TransformSection } from './inspector/TransformSection'
import { TemplateSection } from './inspector/TemplateSection'
import { BackgroundSection } from './inspector/BackgroundSection'

const STORAGE_KEY = 'inkidea-cover-inspector-sections-v1'

type SectionId = 'layers' | 'props' | 'adjust' | 'transform' | 'template' | 'bg'

const DEFAULT_OPEN: Record<SectionId, boolean> = {
  layers: true,
  props: true,
  adjust: true,
  transform: false,
  template: true,
  bg: false,
}

function readStoredOpen(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_OPEN }
    const parsed = JSON.parse(raw) as Partial<Record<SectionId, boolean>>
    return { ...DEFAULT_OPEN, ...parsed }
  } catch {
    return { ...DEFAULT_OPEN }
  }
}

export function CoverInspectorPanel() {
  const {
    selectedObject,
    busy,
    saveCoverTemplate,
    loadCoverTemplateFromProject,
    loadCoverTemplate,
    revealCoverTemplateFolder,
  } = useCoverEditorCtx()
  const [openMap, setOpenMap] = useState<Record<SectionId, boolean>>(() => readStoredOpen())

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openMap)) } catch { /* ignore */ }
  }, [openMap])

  const toggle = (id: SectionId) => setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))

  const selectedKind = selectedObject
    ? ((selectedObject as fabric.Object & { inkideaLayerKind?: InkLayerKind }).inkideaLayerKind)
    : undefined

  // Auto-open Properties + Adjustments when user selects a layer
  useEffect(() => {
    if (!selectedKind) return
    setOpenMap((prev) => {
      const next = { ...prev }
      if (!next.props) next.props = true
      if ((selectedKind === 'image' || selectedKind === 'background') && !next.adjust) next.adjust = true
      return next
    })
  }, [selectedKind])

  return (
    <aside
      className={cn(
        'order-3 flex max-h-[min(88vh,1080px)] min-h-0 w-full min-w-0 flex-col overflow-y-auto overflow-x-hidden',
        'xl:order-3 xl:max-h-none xl:w-[336px] xl:max-w-[336px] xl:shrink-0',
        zoneRightRail
      )}
      aria-label="แผงควบคุมปก"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-vscode-border bg-vscode-section-header-bg/60 px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-vscode-muted">เทมเพลต</span>
        <div className="ml-auto flex items-center gap-1">
          <AppButton tone="primary" disabled={busy} onPress={saveCoverTemplate}
            title="บันทึกเทมเพลต (canvas + รูปภาพ + การตั้งค่า) ลง Cover/cover-template.json ของโปรเจกต์"
            className="min-h-8 gap-1 px-2 text-[11px]">
            <Save className="h-3 w-3 shrink-0" aria-hidden />
            บันทึก
          </AppButton>
          <AppButton tone="zinc" variant="flat" disabled={busy} onPress={loadCoverTemplateFromProject}
            title="โหลดเทมเพลตที่บันทึกไว้ในโปรเจกต์นี้"
            className="min-h-8 gap-1 px-2 text-[11px]">
            <FolderOpen className="h-3 w-3 shrink-0" aria-hidden />
            โหลด
          </AppButton>
          <AppButton tone="zinc" variant="flat" disabled={busy} onPress={loadCoverTemplate}
            title="นำเข้าเทมเพลตจากไฟล์ .json (สำหรับแชร์)"
            className="min-h-8 px-1.5 text-[11px]">
            <Upload className="h-3 w-3 shrink-0" aria-hidden />
          </AppButton>
          <AppButton tone="zinc" variant="flat" disabled={busy} onPress={revealCoverTemplateFolder}
            title="เปิดโฟลเดอร์ Cover ของโปรเจกต์ใน File Explorer"
            className="min-h-8 px-1.5 text-[11px]">
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
          </AppButton>
        </div>
      </div>
      <UploadDock />
      <LayersSection open={openMap.layers} onToggle={() => toggle('layers')} />
      <PropertiesSection open={openMap.props} onToggle={() => toggle('props')} />
      <AdjustmentsSection open={openMap.adjust} onToggle={() => toggle('adjust')} />
      <TransformSection open={openMap.transform} onToggle={() => toggle('transform')} />
      <TemplateSection open={openMap.template} onToggle={() => toggle('template')} />
      <BackgroundSection open={openMap.bg} onToggle={() => toggle('bg')} />
    </aside>
  )
}
