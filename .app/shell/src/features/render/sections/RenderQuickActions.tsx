/**
 * RenderQuickActions — ปุ่มลัดด้านล่าง sidebar nav ของแท็บคลิป
 */

import { Codicon, HubSettingsButton, cn } from '@shared/ui'
import { useRender } from '../useRender'
import type { useRenderJob } from '../useRenderJob'

type JobBridge = ReturnType<typeof useRenderJob>

export function RenderQuickActions({ job }: { job: JobBridge }) {
  const audioFiles = useRender((s) => s.audioFiles)
  const selectedAudioFiles = useRender((s) => s.selectedAudioFiles)
  const busy = useRender((s) => s.busy)
  const status = useRender((s) => s.status)
  const summaryText = useRender((s) => s.summaryText)

  const total = audioFiles.length
  const selected = selectedAudioFiles.size
  const successMatch = summaryText?.match(/เสร็จ:\s*(\d+)\/(\d+)/u)
  const success = successMatch ? parseInt(successMatch[1], 10) : 0
  const failed = successMatch ? Math.max(0, parseInt(successMatch[2], 10) - success) : 0

  return (
    <div className="flex flex-col gap-1.5 pb-1">
      <HubSettingsButton
        tone="primary"
        gradient
        icon={<Codicon name={busy ? 'loading' : 'play'} size={13} spin={busy} />}
        onClick={() => void job.startRender()}
        disabled={busy || selected === 0}
        title="เริ่มเรนเดอร์ไฟล์ที่เลือก"
      >
        {busy ? 'กำลังเรนเดอร์' : `เรนเดอร์ ${selected}`}
      </HubSettingsButton>

      <HubSettingsButton
        tone="danger"
        icon={<Codicon name="debug-stop" size={13} />}
        onClick={() => void job.cancelRender()}
        disabled={!busy}
        title="หยุดการเรนเดอร์ที่กำลังทำงาน"
      >
        หยุด
      </HubSettingsButton>

      <div className="mt-1 flex items-center gap-1 border-t border-vscode-border/40 pt-2 text-[10px]">
        <Codicon
          name={failed > 0 ? 'warning' : success > 0 ? 'check' : 'pulse'}
          size={10}
          className={cn(
            'shrink-0',
            failed > 0 ? 'text-vscode-error' : success > 0 ? 'text-vscode-success' : 'text-vscode-muted'
          )}
        />
        <span
          className="flex-1 truncate text-vscode-muted"
          title={`เลือก ${selected}/${total} · เสร็จ ${success} · ล้มเหลว ${failed} · ${status}`}
        >
          เลือก {selected}/{total} · เสร็จ {success}
        </span>
      </div>
    </div>
  )
}
