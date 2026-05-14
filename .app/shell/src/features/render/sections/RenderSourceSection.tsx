/**
 * Section "แหล่งข้อมูล" — ภาพปก + โฟลเดอร์เสียง + โฟลเดอร์ปลายทาง + multi-cover toggle + คำนำหน้าชื่อ
 */

import {
  Codicon,
  HubSettingsButton,
  HubSettingsCheckRow,
  HubSettingsField,
  HubSettingsInput,
} from '@shared/ui'
import { useRender } from '../useRender'
import type { useRenderJob } from '../useRenderJob'
import { useHubWorkspace } from '@/state/useHubWorkspace'

type JobBridge = ReturnType<typeof useRenderJob>

export function RenderSourceSection({ job }: { job: JobBridge }) {
  const openFolder = useHubWorkspace((s) => s.openFolder)

  const imagePath = useRender((s) => s.imagePath)
  const setImagePath = useRender((s) => s.setImagePath)
  const audioFolder = useRender((s) => s.audioFolder)
  const setAudioFolder = useRender((s) => s.setAudioFolder)
  const outputFolder = useRender((s) => s.outputFolder)
  const setOutputFolder = useRender((s) => s.setOutputFolder)
  const coverFolder = useRender((s) => s.coverFolder)
  const setCoverFolder = useRender((s) => s.setCoverFolder)
  const useMultipleCovers = useRender((s) => s.useMultipleCovers)
  const setUseMultipleCovers = useRender((s) => s.setUseMultipleCovers)
  const titlePrefix = useRender((s) => s.titlePrefix)
  const setTitlePrefix = useRender((s) => s.setTitlePrefix)
  const introClipPath = useRender((s) => s.introClipPath)
  const setIntroClipPath = useRender((s) => s.setIntroClipPath)
  const busy = useRender((s) => s.busy)

  return (
    <div className="space-y-3">
      <HubSettingsField label="ภาพปกหลัก" hint="PNG / JPG / JPEG — ใช้เมื่อไม่เปิดโหมดปกหลายไฟล์">
        <div className="flex gap-2">
          <HubSettingsInput
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            disabled={useMultipleCovers || busy}
            placeholder="ยังไม่ได้เลือก…"
          />
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="folder-opened" />}
            title="เลือกไฟล์ภาพปก"
            disabled={useMultipleCovers || busy}
            onClick={() => void job.chooseImage()}
            className="shrink-0"
          >
            เลือกไฟล์
          </HubSettingsButton>
        </div>
      </HubSettingsField>

      <HubSettingsCheckRow
        tone="info"
        icon={<Codicon name="layers" />}
        label="โหมดปกหลายไฟล์"
        hint="จับคู่ภาพปกกับไฟล์เสียงอัตโนมัติตามหมายเลข"
        checked={useMultipleCovers}
        onChange={(v) => setUseMultipleCovers(v)}
        disabled={busy}
      />

      <HubSettingsField label="โฟลเดอร์ภาพปก" hint="โฟลเดอร์ที่มีไฟล์ภาพปกหลายไฟล์">
        <div className="flex gap-2">
          <HubSettingsInput
            value={coverFolder}
            onChange={(e) => setCoverFolder(e.target.value)}
            disabled={!useMultipleCovers || busy}
            placeholder="ยังไม่ได้เลือก…"
          />
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="folder-opened" />}
            title="เลือกโฟลเดอร์ภาพปก"
            disabled={!useMultipleCovers || busy}
            onClick={() => void job.chooseFolder(setCoverFolder)}
            className="shrink-0"
          >
            เลือก
          </HubSettingsButton>
        </div>
      </HubSettingsField>

      <HubSettingsField
        label="แทรกอินโทร (ไม่บังคับ)"
        hint="ไฟล์ MP4/MOV/MKV/WEBM — จะถูกแทรกหน้าทุกตอน ก่อนช่วงภาพปก"
      >
        <div className="flex gap-2">
          <HubSettingsInput
            value={introClipPath}
            onChange={(e) => setIntroClipPath(e.target.value)}
            disabled={busy}
            placeholder="ยังไม่ได้เลือก — เว้นว่างเพื่อไม่ใช้อินโทร"
          />
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="device-camera-video" />}
            title="เลือกไฟล์อินโทร"
            disabled={busy}
            onClick={() => void job.chooseIntroClip()}
            className="shrink-0"
          >
            เลือกไฟล์
          </HubSettingsButton>
          {introClipPath ? (
            <HubSettingsButton
              size="sm"
              tone="ghost"
              icon={<Codicon name="close" />}
              title="ยกเลิกการใช้อินโทร"
              disabled={busy}
              onClick={() => setIntroClipPath('')}
              className="shrink-0"
            >
              ล้าง
            </HubSettingsButton>
          ) : null}
        </div>
      </HubSettingsField>

      <HubSettingsField label="คำนำหน้าชื่อไฟล์วิดีโอ" hint="ตัวเลขจากชื่อเสียงต่อท้ายอัตโนมัติ">
        <HubSettingsInput
          value={titlePrefix}
          onChange={(e) => setTitlePrefix(e.target.value)}
          disabled={busy}
          placeholder="เช่น นิยาย EP, ตอนที่ …"
        />
      </HubSettingsField>

      <HubSettingsField label="โฟลเดอร์ไฟล์เสียง" hint="WAV / MP3 / M4A">
        <div className="flex gap-2">
          <HubSettingsInput
            value={audioFolder}
            onChange={(e) => setAudioFolder(e.target.value)}
            disabled={busy}
            placeholder="ยังไม่ได้เลือก…"
          />
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="music" />}
            title="เลือกโฟลเดอร์ไฟล์เสียง"
            disabled={busy}
            onClick={() => void job.chooseAudioFolder()}
            className="shrink-0"
          >
            เลือก
          </HubSettingsButton>
        </div>
      </HubSettingsField>

      <HubSettingsField label="โฟลเดอร์ปลายทาง" hint="โฟลเดอร์บันทึกวิดีโอที่สร้างเสร็จ">
        <div className="flex gap-2">
          <HubSettingsInput
            value={outputFolder}
            onChange={(e) => setOutputFolder(e.target.value)}
            disabled={busy}
            placeholder="ยังไม่ได้เลือก…"
          />
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="folder-opened" />}
            title="เลือกโฟลเดอร์ปลายทาง"
            disabled={busy}
            onClick={() => void job.chooseFolder(setOutputFolder)}
            className="shrink-0"
          >
            เลือก
          </HubSettingsButton>
          <HubSettingsButton
            size="sm"
            tone="ghost"
            icon={<Codicon name="folder-opened" />}
            title="เปิดโฟลเดอร์ผลลัพธ์"
            disabled={busy || !outputFolder}
            onClick={() => void openFolder(outputFolder)}
            className="shrink-0"
          >
            เปิดโฟลเดอร์
          </HubSettingsButton>
        </div>
      </HubSettingsField>
    </div>
  )
}
