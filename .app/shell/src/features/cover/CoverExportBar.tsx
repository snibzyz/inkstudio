import { useState } from 'react'
import { Download, FolderOpen, Settings } from 'lucide-react'
import { AppButton, hubSettingsInputClass, IdeDialog } from '@shared/ui'
import { useCoverEditorCtx } from './CoverEditorContext'

type ExportStep = 'choose' | 'batch'

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-vscode-border">
      <div
        className="h-full bg-vscode-focus transition-[width] duration-200"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  )
}

export function CoverExportBar() {
  const {
    busy,
    exportStatus,
    batchProgress,
    outputFormat, setOutputFormat,
    quality, setQuality,
    batchStart, setBatchStart,
    batchEnd, setBatchEnd,
    batchLength, setBatchLength,
    batchPadding, setBatchPadding,
    batchOutputFolder, setBatchOutputFolder,
    chooseFolder,
    exportSingle,
    exportBatch,
  } = useCoverEditorCtx()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportStep, setExportStep] = useState<ExportStep>('choose')

  function openExportModal() {
    setExportStep('choose')
    setExportOpen(true)
  }

  async function handleSingle() {
    setExportOpen(false)
    await exportSingle()
  }

  function handlePickBatch() {
    setExportStep('batch')
  }

  async function handleBatch() {
    await exportBatch()
    setExportOpen(false)
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-vscode-border bg-vscode-surface px-3 py-2" aria-label="ส่งออกปก">
      {/* Status */}
      <div className="min-w-0 flex-1">
        {busy ? (
          <div className="space-y-1">
            <p className="truncate text-[11px] text-vscode-muted">{exportStatus || 'กำลังส่งออก…'}</p>
            {batchProgress > 0 ? <ProgressBar value={batchProgress} /> : null}
          </div>
        ) : exportStatus ? (
          <p className="truncate text-[11px] text-vscode-success">{exportStatus}</p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <AppButton
          tone="zinc"
          variant="flat"
          title="ตั้งค่าการส่งออก"
          disabled={busy}
          onPress={() => setSettingsOpen(true)}
          className="min-h-8 px-2"
        >
          <Settings className="h-4 w-4" />
        </AppButton>

        <AppButton tone="primary" disabled={busy} onPress={openExportModal}
          className="min-h-8 gap-1.5 whitespace-nowrap px-3 text-[12px]">
          <Download className="h-3.5 w-3.5" />
          ส่งออก
        </AppButton>
      </div>

      {/* ─── Settings modal (gear) ─── */}
      <IdeDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="ตั้งค่าการส่งออก"
        size="lg"
        footer={
          <div className="flex justify-end">
            <AppButton onPress={() => setSettingsOpen(false)} className="px-4 text-[12px]">ปิด</AppButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-vscode-fg-dim">รูปแบบไฟล์</div>
            <div className="flex gap-2">
              {(['png', 'jpg'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setOutputFormat(fmt)}
                  className={`h-8 flex-1 rounded-sm border text-[12px] font-medium transition-colors ${
                    outputFormat === fmt
                      ? 'border-vscode-focus bg-vscode-focus/15 text-vscode-fg'
                      : 'border-vscode-border text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
                  }`}
                >
                  {fmt.toUpperCase()}
                  {fmt === 'png' && <span className="ml-1 text-[10px] text-vscode-muted">(ไม่สูญเสียคุณภาพ)</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-[11px] font-medium text-vscode-fg-dim">
              <span>{outputFormat === 'png' ? 'ความละเอียด (1x–2x)' : 'คุณภาพ'}</span>
              <span className="tabular-nums text-vscode-muted">
                {outputFormat === 'png'
                  ? `${(1 + quality / 100).toFixed(2)}x`
                  : `${quality}%`}
              </span>
            </div>
            <input
              type="range" min={1} max={100} step={1} value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-vscode-focus"
            />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-medium text-vscode-fg-dim">โฟลเดอร์ส่งออก (แบตช์)</div>
            <div className="flex gap-2">
              <input
                value={batchOutputFolder}
                onChange={(e) => setBatchOutputFolder(e.target.value)}
                placeholder="เลือกโฟลเดอร์…"
                className={`${hubSettingsInputClass} flex-1`}
              />
              <AppButton
                tone="zinc"
                variant="flat"
                title="เลือกโฟลเดอร์"
                onPress={() => void chooseFolder(setBatchOutputFolder)}
                className="min-h-8 gap-1.5 px-3 text-[12px]"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                เลือก
              </AppButton>
            </div>
          </div>
        </div>
      </IdeDialog>

      {/* ─── Export modal ─── */}
      <IdeDialog
        open={exportOpen}
        onClose={() => !busy && setExportOpen(false)}
        title={exportStep === 'choose' ? 'ส่งออกปก' : 'ส่งออกหลายไฟล์'}
        size="lg"
        footer={
          exportStep === 'batch' ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setExportStep('choose')}
                className="text-[12px] text-vscode-muted hover:text-vscode-fg disabled:opacity-40"
              >
                ← กลับ
              </button>
              <AppButton tone="primary" disabled={busy} onPress={() => void handleBatch()}
                className="px-5 text-[12px]">
                เริ่มส่งออก
              </AppButton>
            </div>
          ) : null
        }
      >
        {exportStep === 'choose' ? (
          <div className="grid grid-cols-2 gap-3 py-1">
            <button
              type="button"
              onClick={() => void handleSingle()}
              className="flex flex-col items-center gap-2 rounded border border-vscode-border p-5 text-center transition-colors hover:border-vscode-focus hover:bg-vscode-focus/10"
            >
              <Download className="h-7 w-7 text-vscode-muted" />
              <span className="text-[13px] font-medium text-vscode-fg">ไฟล์เดียว</span>
              <span className="text-[11px] text-vscode-muted">บันทึกไฟล์ภาพเดียว</span>
            </button>
            <button
              type="button"
              onClick={handlePickBatch}
              className="flex flex-col items-center gap-2 rounded border border-vscode-border p-5 text-center transition-colors hover:border-vscode-focus hover:bg-vscode-focus/10"
            >
              <svg className="h-7 w-7 text-vscode-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="7" width="14" height="13" rx="1.5" />
                <path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
              </svg>
              <span className="text-[13px] font-medium text-vscode-fg">หลายไฟล์</span>
              <span className="text-[11px] text-vscode-muted">ส่งออกหลายตอนพร้อมกัน</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Folder */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-vscode-fg-dim">โฟลเดอร์ปลายทาง</div>
              <div className="flex gap-2">
                <input
                  value={batchOutputFolder}
                  onChange={(e) => setBatchOutputFolder(e.target.value)}
                  disabled={busy}
                  placeholder="เลือกโฟลเดอร์…"
                  className={`${hubSettingsInputClass} flex-1`}
                />
                <AppButton
                  tone="zinc"
                  variant="flat"
                  title="เลือกโฟลเดอร์"
                  disabled={busy}
                  onPress={() => void chooseFolder(setBatchOutputFolder)}
                  className="min-h-8 gap-1.5 px-3 text-[12px]"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  เลือก
                </AppButton>
              </div>
            </div>

            {/* Range */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'เริ่ม', value: batchStart, set: setBatchStart },
                { label: 'จบ', value: batchEnd, set: setBatchEnd },
                { label: 'ต่อชุด', value: batchLength, set: setBatchLength },
                { label: 'เติมศูนย์', value: batchPadding, set: setBatchPadding },
              ].map(({ label, value, set }) => (
                <label key={label} className="block">
                  <div className="mb-1 text-[11px] font-medium text-vscode-fg-dim">{label}</div>
                  <input
                    type="number" min={1} value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    disabled={busy}
                    className={hubSettingsInputClass}
                  />
                </label>
              ))}
            </div>

            {/* Quality summary */}
            <div className="rounded-sm bg-vscode-sidebar px-3 py-2 text-[11px] text-vscode-muted">
              รูปแบบ: <span className="text-vscode-fg">{outputFormat.toUpperCase()}</span>
              {outputFormat === 'jpg' && (
                <> · คุณภาพ: <span className="text-vscode-fg">{quality}%</span></>
              )}
              {outputFormat === 'png' && (
                <> · ความละเอียด: <span className="text-vscode-fg">{(1 + quality / 100).toFixed(2)}x</span></>
              )}
              <span className="ml-2 text-vscode-muted/60">เปลี่ยนได้ที่ ⚙</span>
            </div>

            {/* Progress */}
            {busy ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-vscode-muted">{exportStatus || 'กำลังส่งออก…'}</p>
                <ProgressBar value={batchProgress} />
              </div>
            ) : null}
          </div>
        )}
      </IdeDialog>
    </div>
  )
}
