/**
 * Section "ภาพรวม" — สถิติคิวงาน + สถานะปัจจุบัน
 *   - แสดงจำนวนไฟล์ที่เลือก / ทั้งหมด / สำเร็จ / ผิดพลาด / ETA
 *   - สรุปสถานะ encoder + resolution ที่จะใช้เรนเดอร์
 */

import { useMemo } from 'react'
import {
  Codicon,
  HubSettingsAlert,
  HubSettingsStat,
  HubSettingsStatGrid,
} from '@shared/ui'
import { useRender } from '../useRender'
import { FIXED_PROFILE_INFO } from '../renderConstants'

export function RenderOverviewSection() {
  const audioFiles = useRender((s) => s.audioFiles)
  const selectedAudioFiles = useRender((s) => s.selectedAudioFiles)
  const introClipPath = useRender((s) => s.introClipPath)
  const status = useRender((s) => s.status)
  const progress = useRender((s) => s.progress)
  const etaText = useRender((s) => s.etaText)
  const summaryText = useRender((s) => s.summaryText)
  const busy = useRender((s) => s.busy)

  const selectedCount = selectedAudioFiles.size
  const totalCount = audioFiles.length

  const summaryParts = useMemo(() => {
    const parts: { successCount?: number; failedCount?: number } = {}
    if (!summaryText) return parts
    const m1 = summaryText.match(/เสร็จ:\s*(\d+)\/(\d+)/u)
    if (m1) {
      parts.successCount = parseInt(m1[1], 10)
      parts.failedCount = Math.max(0, parseInt(m1[2], 10) - parseInt(m1[1], 10))
    }
    return parts
  }, [summaryText])

  return (
    <div className="space-y-3">
      <HubSettingsStatGrid cols={4}>
        <HubSettingsStat
          icon={<Codicon name="list-flat" />}
          label="ที่เลือกในคิว"
          value={selectedCount.toLocaleString()}
          hint={`จากทั้งหมด ${totalCount.toLocaleString()}`}
          tone={selectedCount > 0 ? 'info' : 'neutral'}
        />
        <HubSettingsStat
          icon={<Codicon name="check" />}
          label="สำเร็จ"
          value={(summaryParts.successCount ?? 0).toLocaleString()}
          hint={summaryParts.successCount != null ? 'จากการเรนเดอร์ล่าสุด' : 'ยังไม่เคยเรนเดอร์'}
          tone={(summaryParts.successCount ?? 0) > 0 ? 'success' : 'neutral'}
        />
        <HubSettingsStat
          icon={<Codicon name="error" />}
          label="ผิดพลาด/ข้าม"
          value={(summaryParts.failedCount ?? 0).toLocaleString()}
          hint={summaryParts.failedCount != null ? 'จากการเรนเดอร์ล่าสุด' : 'ยังไม่เคยเรนเดอร์'}
          tone={(summaryParts.failedCount ?? 0) > 0 ? 'warning' : 'neutral'}
        />
        <HubSettingsStat
          icon={<Codicon name="watch" />}
          label="คาดเหลือเวลา"
          value={busy ? (etaText.replace('เหลือ:', '').trim() || '—') : '—'}
          hint={busy ? 'กำลังประมวลผล' : 'พร้อมเริ่ม'}
          tone={busy ? 'info' : 'neutral'}
        />
      </HubSettingsStatGrid>

      <HubSettingsAlert tone={busy ? 'info' : 'neutral'} icon={<Codicon name={busy ? 'loading' : 'play-circle'} spin={busy} />}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-vscode-fg">{status}</span>
          <span className="text-vscode-muted">·</span>
          <span className="text-vscode-fg-dim">{FIXED_PROFILE_INFO}</span>
          <span className="text-vscode-muted">·</span>
          <span className="text-vscode-fg-dim">preset ultrafast</span>
          {introClipPath ? (
            <>
              <span className="text-vscode-muted">·</span>
              <span className="text-vscode-fg-dim">+ อินโทร</span>
            </>
          ) : null}
          {busy ? (
            <>
              <span className="text-vscode-muted">·</span>
              <span className="font-bold tabular-nums text-vscode-focus">
                {Math.round(progress * 100)}%
              </span>
            </>
          ) : null}
        </div>
      </HubSettingsAlert>
    </div>
  )
}
