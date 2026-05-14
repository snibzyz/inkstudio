/**
 * Section "ไฟล์เสียง" — list + search + checkbox + select-all
 *   - List: scroll สูงสุด ~22rem (ถ้า > 200 ไฟล์: เปิด virtualization-friendly mode ผ่าน max-height + ขนาดบรรทัดคงที่)
 *   - Search: filter เฉพาะชื่อไฟล์ที่ตรงกับ query
 *   - Toolbar: ทั้งหมด / ไม่เลือก / สลับ / รีเฟรช
 */

import { useMemo } from 'react'
import {
  cn,
  Codicon,
  HubSettingsActionRow,
  HubSettingsButton,
  HubSettingsEmptyState,
  HubSettingsFilePickerHeader,
  HubSettingsInput,
} from '@shared/ui'
import { useRender } from '../useRender'
import type { useRenderJob } from '../useRenderJob'

type JobBridge = ReturnType<typeof useRenderJob>

const VIRTUAL_THRESHOLD = 200

export function RenderFilesSection({ job }: { job: JobBridge }) {
  const audioFiles = useRender((s) => s.audioFiles)
  const audioSearch = useRender((s) => s.audioSearch)
  const setAudioSearch = useRender((s) => s.setAudioSearch)
  const selectedAudioFiles = useRender((s) => s.selectedAudioFiles)
  const selectAll = useRender((s) => s.selectAll)
  const clearSelection = useRender((s) => s.clearSelection)
  const toggleAudioFile = useRender((s) => s.toggleAudioFile)
  const setSelectedAudioFiles = useRender((s) => s.setSelectedAudioFiles)
  const busy = useRender((s) => s.busy)

  const visibleFiles = useMemo(() => {
    const q = audioSearch.trim().toLowerCase()
    if (!q) return audioFiles
    return audioFiles.filter((f) => f.toLowerCase().includes(q))
  }, [audioFiles, audioSearch])

  const useVirtual = audioFiles.length > VIRTUAL_THRESHOLD
  const selectedCount = selectedAudioFiles.size

  return (
    <div className="space-y-2.5">
      <HubSettingsFilePickerHeader
        tone="info"
        selectedCount={selectedCount}
        totalCount={audioFiles.length}
        onSelectAll={() => selectAll()}
        onSelectNone={() => clearSelection()}
        hint={useVirtual ? `รายการเยอะ — ใช้ค้นหาเพื่อกรอง` : undefined}
      />

      <div className="flex gap-2">
        <HubSettingsInput
          value={audioSearch}
          onChange={(e) => setAudioSearch(e.target.value)}
          disabled={busy || audioFiles.length === 0}
          placeholder="ค้นหาไฟล์…"
        />
        <HubSettingsButton
          tone="secondary"
          icon={<Codicon name="refresh" />}
          onClick={() => void job.refreshAudioPreview()}
          disabled={busy || !audioFiles.length}
          className="shrink-0"
          title="โหลดรายการไฟล์ใหม่"
        >
          รีเฟรช
        </HubSettingsButton>
      </div>

      <HubSettingsActionRow>
        <HubSettingsButton
          size="sm"
          onClick={() =>
            setSelectedAudioFiles((prev) => {
              const next = new Set<string>()
              for (const f of audioFiles) if (!prev.has(f)) next.add(f)
              return next
            })
          }
          disabled={busy || audioFiles.length === 0}
          title="สลับการเลือก"
        >
          <Codicon name="arrow-swap" /> สลับ
        </HubSettingsButton>
      </HubSettingsActionRow>

      {audioFiles.length === 0 ? (
        <HubSettingsEmptyState
          icon={<Codicon name="music" size={22} />}
          title="ยังไม่มีไฟล์เสียง"
          description="เลือกโฟลเดอร์ที่มี .wav / .mp3 / .m4a เพื่อโหลดรายการ"
        />
      ) : visibleFiles.length === 0 ? (
        <HubSettingsEmptyState
          icon={<Codicon name="search" size={22} />}
          title="ไม่พบไฟล์ที่ตรงกับคำค้นหา"
        />
      ) : (
        <div
          className={cn(
            'space-y-0.5 overflow-y-auto rounded-sm border border-vscode-border/60 bg-vscode-input/10',
            useVirtual ? 'max-h-[24rem]' : 'max-h-[18rem]'
          )}
          role="listbox"
          aria-multiselectable
        >
          {visibleFiles.map((file) => {
            const checked = selectedAudioFiles.has(file)
            return (
              <label
                key={file}
                className={cn(
                  'flex cursor-pointer items-center gap-2 border-l-[2px] px-2.5 py-[5px] text-[12px] transition-colors',
                  checked
                    ? 'border-l-vscode-success bg-vscode-success/10 text-vscode-fg'
                    : 'border-l-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={() => toggleAudioFile(file)}
                  className="h-3.5 w-3.5 accent-vscode-success"
                />
                <span className="min-w-0 flex-1 truncate" title={file}>
                  {file}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
