import { AppButton, cn, hubSettingsInputClass } from '@shared/ui'
import { Image as ImageIcon, ImagePlus, ScanLine } from 'lucide-react'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { smartFormatEpisode } from '../coverEditorUtils'

export function UploadDock() {
  const {
    busy,
    templateTitle, setTemplateTitle,
    templateEpisode, setTemplateEpisode,
    chooseTemplateCoverImageForCrop,
    loadTemplateCoverImageFromDataUrl,
    loadTemplateCustomBackground,
    loadTemplateCreditImage,
    openCoverCropDialog,
  } = useCoverEditorCtx()

  return (
    <div className="space-y-2 border-b border-vscode-border bg-vscode-section-header-bg/60 px-2 py-2">
      <div className="grid grid-cols-3 gap-1.5">
        <AppButton
          tone="primary"
          disabled={busy}
          onPress={async () => {
            const dataUrl = await chooseTemplateCoverImageForCrop()
            if (!dataUrl) return
            const originalUrl = dataUrl
            openCoverCropDialog('cover', dataUrl, async (croppedUrl) => {
              await loadTemplateCoverImageFromDataUrl(croppedUrl, originalUrl)
            })
          }}
          className="min-h-9 justify-center gap-1.5 px-2 text-[11px] leading-tight"
          title="อัปโหลดภาพปกหลัก (ปก 3:4 + พื้นหลัง 16:9 + เบลออัตโนมัติ)"
        >
          <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          อัปปก
        </AppButton>
        <AppButton
          tone="zinc"
          variant="flat"
          disabled={busy}
          onPress={async () => {
            const dataUrl = await chooseTemplateCoverImageForCrop()
            if (dataUrl) openCoverCropDialog('background', dataUrl, loadTemplateCustomBackground)
          }}
          className="min-h-9 justify-center gap-1.5 px-2 text-[11px] leading-tight"
          title="อัปโหลดเฉพาะพื้นหลัง (ไม่เบลออัตโนมัติ — ปรับเองในแถบปรับแต่งภาพ)"
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          พื้นหลัง
        </AppButton>
        <AppButton
          tone="zinc"
          variant="flat"
          disabled={busy}
          onPress={async () => {
            const dataUrl = await chooseTemplateCoverImageForCrop()
            if (dataUrl) openCoverCropDialog('credit', dataUrl, loadTemplateCreditImage)
          }}
          className="min-h-9 justify-center gap-1.5 px-2 text-[11px] leading-tight"
          title="อัปโหลดภาพเครดิต (3:1)"
        >
          <ScanLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
          เครดิต
        </AppButton>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-1.5">
        <input
          value={templateTitle}
          onChange={(e) => setTemplateTitle(e.target.value)}
          placeholder="ชื่อเรื่อง"
          aria-label="ชื่อเรื่อง"
          className={cn(hubSettingsInputClass, 'py-1')}
        />
        <input
          value={templateEpisode}
          onChange={(e) => setTemplateEpisode(e.target.value)}
          onBlur={(e) => {
            const next = smartFormatEpisode(e.target.value)
            if (next !== e.target.value) setTemplateEpisode(next)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const next = smartFormatEpisode(e.currentTarget.value)
              if (next !== e.currentTarget.value) setTemplateEpisode(next)
              e.currentTarget.blur()
            }
          }}
          placeholder="ตอน"
          aria-label="เลขตอน (เช่น 1, 1-50)"
          title="พิมพ์ &quot;1&quot; → 001 หรือ &quot;1-50&quot; → 001-050"
          className={cn(hubSettingsInputClass, 'w-[96px] py-1 text-center tabular-nums')}
        />
      </div>
    </div>
  )
}
