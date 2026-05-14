/**
 * Section "ควบคุมการเรนเดอร์" — start/stop button + progress bar + log stream
 *   - Start: gradient primary button (disabled ขณะ busy)
 *   - Stop: secondary danger (เปิดเมื่อ busy เท่านั้น)
 *   - Status card: file ปัจจุบัน + เวลาที่ run + ETA
 *   - Summary alert (success) + Log stream (max 200 บรรทัด)
 */

import {
  cn,
  Codicon,
  HubSettingsActionRow,
  HubSettingsAlert,
  HubSettingsButton,
} from '@shared/ui'
import { useRender } from '../useRender'
import type { useRenderJob } from '../useRenderJob'

type JobBridge = ReturnType<typeof useRenderJob>

function basename(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

export function RenderProgressSection({ job }: { job: JobBridge }) {
  const busy = useRender((s) => s.busy)
  const status = useRender((s) => s.status)
  const progress = useRender((s) => s.progress)
  const currentFile = useRender((s) => s.currentFile)
  const fileProgressText = useRender((s) => s.fileProgressText)
  const etaText = useRender((s) => s.etaText)
  const summaryText = useRender((s) => s.summaryText)
  const logs = useRender((s) => s.logs)
  const error = useRender((s) => s.error)

  const progressPct = Math.round(progress * 1000) / 10

  return (
    <div className="space-y-3">
      {error ? (
        <HubSettingsAlert tone="danger" icon={<Codicon name="error" />} title="ข้อผิดพลาด">
          {error}
        </HubSettingsAlert>
      ) : null}

      <HubSettingsActionRow>
        <HubSettingsButton
          tone="primary"
          gradient
          icon={busy ? <Codicon name="loading" spin /> : <Codicon name="play" />}
          title={busy ? 'กำลังเรนเดอร์อยู่…' : 'เริ่มเรนเดอร์ไฟล์ที่เลือก'}
          onClick={() => void job.startRender()}
          disabled={busy}
          className="flex-1"
        >
          {busy ? 'กำลังเรนเดอร์…' : 'เริ่มเรนเดอร์'}
        </HubSettingsButton>
        <HubSettingsButton
          tone="danger"
          icon={<Codicon name="debug-stop" />}
          title="หยุดการเรนเดอร์ที่กำลังทำงาน"
          onClick={() => void job.cancelRender()}
          disabled={!busy}
          className="flex-1"
        >
          หยุด
        </HubSettingsButton>
      </HubSettingsActionRow>

      <div className="rounded-sm border border-vscode-border/70 bg-vscode-input/15 p-3">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="min-w-0 truncate text-vscode-fg-dim" title={status}>
            {status}
          </span>
          <span className="shrink-0 rounded-sm border border-vscode-border bg-vscode-input/40 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-vscode-fg-bright">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div
          className="mt-2 h-[3px] overflow-hidden rounded-full bg-vscode-border"
          role="progressbar"
          aria-label="ความคืบหน้าการเรนเดอร์"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full rounded-full bg-gradient-to-r from-vscode-focus to-violet-500 transition-all duration-300',
              busy ? 'animate-pulse' : ''
            )}
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>

        {currentFile ? (
          <div className="mt-2.5 rounded-sm bg-vscode-surface/60 px-2.5 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-vscode-muted">กำลังประมวลผล</div>
            <div className="mt-0.5 truncate text-[12px] font-medium text-vscode-fg" title={currentFile}>
              {basename(currentFile)}
            </div>
            {fileProgressText ? (
              <div className="mt-1 text-[11px] text-vscode-fg-dim">{fileProgressText}</div>
            ) : null}
            {etaText ? <div className="text-[11px] text-vscode-muted">{etaText}</div> : null}
          </div>
        ) : null}

        {summaryText ? (
          <pre className="mt-2.5 whitespace-pre-wrap rounded-sm border border-vscode-success/25 bg-vscode-success/10 px-2.5 py-2 text-[11px] leading-relaxed text-vscode-success">
            {summaryText}
          </pre>
        ) : null}

        {logs.length > 0 ? (
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-vscode-muted">
              <Codicon name="output" />
              <span>บันทึก ({logs.length})</span>
            </div>
            <pre className="mt-1 max-h-36 overflow-auto rounded-sm bg-vscode-sidebar px-2 py-1.5 text-[10px] leading-5 text-vscode-fg-dim">
              {logs.join('\n')}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}
