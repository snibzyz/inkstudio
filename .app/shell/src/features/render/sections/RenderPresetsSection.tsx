/**
 * Section "พรีเซ็ตของฉัน" — บันทึก/โหลด/ลบ config ทั้งชุด (source + encoding) ตามชื่อ
 *
 * เก็บใน userData ผ่าน preset:list / preset:save / preset:delete IPC
 */

import { cn, Codicon, HubSettingsActionRow, HubSettingsButton, HubSettingsField, HubSettingsInput, hubSettingsInputClass } from '@shared/ui'
import { useRender } from '../useRender'
import type { useRenderJob } from '../useRenderJob'

type JobBridge = ReturnType<typeof useRenderJob>

export function RenderPresetsSection({ job }: { job: JobBridge }) {
  const presets = useRender((s) => s.presets)
  const selectedPresetName = useRender((s) => s.selectedPresetName)
  const setSelectedPresetName = useRender((s) => s.setSelectedPresetName)
  const presetName = useRender((s) => s.presetName)
  const setPresetName = useRender((s) => s.setPresetName)
  const busy = useRender((s) => s.busy)

  return (
    <div className="space-y-3 rounded-sm border border-vscode-border/70 bg-vscode-input/15 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-vscode-muted">
        <Codicon name="bookmark" />
        <span>ค่าที่จำไว้</span>
      </div>
      <p className="text-[11px] leading-relaxed text-vscode-fg-dim">
        บันทึกการตั้งค่าทั้งหมด (โฟลเดอร์ + คุณภาพ + intro) เป็นชุดเดียว
        เรียกใช้ใหม่ทีหลังได้ ไม่ต้องเซ็ตซ้ำทุกครั้ง
      </p>

      <HubSettingsField label="บันทึกการตั้งค่าตอนนี้">
        <div className="flex gap-2">
          <HubSettingsInput
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            disabled={busy}
            placeholder='ตั้งชื่อ เช่น "นิยายผีฟังก่อนนอน"'
          />
          <HubSettingsButton
            tone="primary"
            icon={<Codicon name="save" />}
            title="บันทึกการตั้งค่าเป็นชุดใหม่"
            onClick={() => void job.savePresetCustom()}
            disabled={busy || !presetName.trim()}
            className="shrink-0"
          >
            บันทึก
          </HubSettingsButton>
        </div>
      </HubSettingsField>

      <HubSettingsField label="เรียกใช้ชุดที่บันทึกไว้">
        <HubSettingsActionRow>
          <select
            value={selectedPresetName}
            onChange={(e) => setSelectedPresetName(e.target.value)}
            disabled={busy}
            className={cn(hubSettingsInputClass, 'flex-1')}
          >
            <option value="">— เลือกจากที่บันทึกไว้ —</option>
            {Object.keys(presets).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="cloud-download" />}
            title="ใช้การตั้งค่าจากชุดที่เลือก"
            onClick={() => void job.loadPresetCustom()}
            disabled={busy || !selectedPresetName}
            className="shrink-0"
          >
            ใช้เลย
          </HubSettingsButton>
          <HubSettingsButton
            tone="danger"
            icon={<Codicon name="trash" />}
            title="ลบชุดที่เลือกออก"
            onClick={() => void job.deletePresetCustom()}
            disabled={busy || !selectedPresetName}
            className="shrink-0"
          >
            ลบ
          </HubSettingsButton>
        </HubSettingsActionRow>
      </HubSettingsField>
    </div>
  )
}
