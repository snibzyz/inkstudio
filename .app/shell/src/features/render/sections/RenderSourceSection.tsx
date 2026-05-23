/**
 * Section "แหล่งข้อมูล" — จัดเป็น 4 กลุ่ม (ภาพปก / เสียง / วิดีโอเปิด / ผลลัพธ์)
 *
 * INKSTUDIO adaptation:
 *  - ไม่มี workspace/project — folder ใช้ absolute path + browse button เท่านั้น
 *  - HubSettingsFolderPicker ยังใช้แต่ options=[] (no project folder dropdown)
 *  - toRel/toAbs เป็น identity เพราะไม่มี workspace root
 */

import {
  Codicon,
  HubSettingsButton,
  HubSettingsField,
  HubSettingsFolderPicker,
  HubSettingsInput,
  HubSettingsSection,
  HubSettingsToggleGroup,
} from '@shared/ui'
import { useRender } from '../useRender'
import type { useRenderJob } from '../useRenderJob'
import { useHubWorkspace } from '@/state/useHubWorkspace'

type JobBridge = ReturnType<typeof useRenderJob>

type CoverMode = 'single' | 'perChapter'

const COVER_MODE_OPTIONS = [
  { value: 'single' as CoverMode, label: 'ปกเดียวกันทุกตอน', hint: 'ใช้ภาพเดียว' },
  { value: 'perChapter' as CoverMode, label: 'ปกแยกแต่ละตอน', hint: 'จับคู่ตามเลขตอน' },
]

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
  const introPath = useRender((s) => s.introPath)
  const setIntroPath = useRender((s) => s.setIntroPath)
  const useIntro = useRender((s) => s.useIntro)
  const setUseIntro = useRender((s) => s.setUseIntro)
  const projectFolders = useRender((s) => s.projectFolders)
  const reloadProjectFolders = useRender((s) => s.reloadProjectFolders)
  const busy = useRender((s) => s.busy)

  /** INKSTUDIO ไม่มี workspace — identity convert (abs ↔ rel เป็น path เดียวกัน) */
  const toRel = (abs: string): string => abs
  const toAbs = (rel: string): string => rel
  const folderOptions = projectFolders.map((f) => ({ rel: f.rel, label: f.label }))

  const coverMode: CoverMode = useMultipleCovers ? 'perChapter' : 'single'
  const introFileName = introPath ? introPath.split(/[/\\]/).pop() : ''

  return (
    <div className="space-y-5">
      {/* ─── 1. ภาพปก ─────────────────────────────────────────── */}
      <HubSettingsSection
        icon={<Codicon name="symbol-color" />}
        title="ภาพปก"
        step={1}
        description="เลือกว่าจะใช้ภาพปกเดียวกันทุกตอน หรือใช้ภาพต่างกันแต่ละตอน"
      >
        <div className="space-y-3">
          <HubSettingsToggleGroup
            ariaLabel="โหมดภาพปก"
            value={coverMode}
            options={COVER_MODE_OPTIONS}
            onChange={(v) => setUseMultipleCovers(v === 'perChapter')}
          />

          {coverMode === 'single' ? (
            <HubSettingsField label="ไฟล์ภาพปก" hint="PNG, JPG หรือ JPEG">
              <div className="flex gap-2">
                <HubSettingsInput
                  value={imagePath}
                  onChange={(e) => setImagePath(e.target.value)}
                  disabled={busy}
                  placeholder="ยังไม่ได้เลือกภาพ…"
                />
                <HubSettingsButton
                  tone="secondary"
                  icon={<Codicon name="file-media" />}
                  title="เลือกไฟล์ภาพปก"
                  disabled={busy}
                  onClick={() => void job.chooseImage()}
                  className="shrink-0"
                >
                  เลือกภาพ
                </HubSettingsButton>
              </div>
            </HubSettingsField>
          ) : (
            <HubSettingsField
              label="โฟลเดอร์ภาพปก"
              hint="ตั้งชื่อภาพให้มีเลขตอน เช่น 1.png, 2.png หรือ 1-10.png สำหรับช่วงตอน"
            >
              <HubSettingsFolderPicker
                icon={<Codicon name="folder" />}
                label="โฟลเดอร์"
                value={toRel(coverFolder)}
                onChange={(rel) => setCoverFolder(toAbs(rel))}
                options={folderOptions}
                onBrowse={() => job.chooseFolder(setCoverFolder)}
                onReload={() => reloadProjectFolders()}
                onOpen={coverFolder ? () => openFolder(coverFolder) : undefined}
                placeholder="ยังไม่ได้เลือกโฟลเดอร์…"
              />
            </HubSettingsField>
          )}
        </div>
      </HubSettingsSection>

      {/* ─── 2. เสียง ─────────────────────────────────────────── */}
      <HubSettingsSection
        icon={<Codicon name="music" />}
        title="เสียงนิยาย"
        step={2}
        description="โฟลเดอร์ที่เก็บไฟล์เสียงของแต่ละตอน — รองรับ WAV, MP3, M4A"
      >
        <HubSettingsFolderPicker
          icon={<Codicon name="music" />}
          label="โฟลเดอร์"
          value={toRel(audioFolder)}
          onChange={(rel) => {
            const abs = toAbs(rel)
            setAudioFolder(abs)
            void job.refreshAudioPreview(abs)
          }}
          options={folderOptions}
          onBrowse={() => job.chooseAudioFolder()}
          onReload={() => reloadProjectFolders()}
          onOpen={audioFolder ? () => openFolder(audioFolder) : undefined}
          placeholder="ยังไม่ได้เลือกโฟลเดอร์…"
        />
      </HubSettingsSection>

      {/* ─── 3. วิดีโอเปิด (intro) ─────────────────────────────── */}
      <HubSettingsSection
        icon={<Codicon name="play-circle" />}
        title="วิดีโอเปิด"
        step={3}
        description="คลิปสั้น ๆ ที่แทรกหน้าทุกตอน เช่น โลโก้ช่อง (ไม่บังคับ — เว้นว่างได้)"
      >
        {introPath ? (
          /** มีไฟล์แล้ว: แสดงชื่อไฟล์ + toggle ใช้งาน + เปลี่ยน + ล้าง */
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-sm border border-vscode-border bg-vscode-input/40 px-2.5 py-1.5">
              <Codicon name="device-camera-video" className="shrink-0 text-vscode-focus" />
              <span
                className="min-w-0 flex-1 truncate text-[12px] text-vscode-fg"
                title={introPath}
              >
                {introFileName}
              </span>
              <button
                type="button"
                onClick={() => setUseIntro(!useIntro)}
                disabled={busy}
                className={`shrink-0 rounded-sm border px-2 py-0.5 text-[10.5px] font-bold transition-colors ${
                  useIntro
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    : 'border-vscode-border bg-vscode-button text-vscode-muted hover:bg-vscode-list-hover'
                }`}
                title={useIntro ? 'กดเพื่อปิดการใช้งาน intro ชั่วคราว' : 'กดเพื่อเปิดใช้ intro'}
              >
                {useIntro ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <HubSettingsButton
                tone="ghost"
                icon={<Codicon name="refresh" />}
                title="เลือกไฟล์อื่นแทน"
                disabled={busy}
                onClick={() => void job.chooseIntro()}
              >
                เปลี่ยนไฟล์
              </HubSettingsButton>
              <HubSettingsButton
                tone="ghost"
                icon={<Codicon name="trash" />}
                title="ล้างไฟล์ intro (ยกเลิกการใช้งาน)"
                disabled={busy}
                onClick={() => { setIntroPath(''); setUseIntro(false) }}
              >
                ล้าง
              </HubSettingsButton>
            </div>
          </div>
        ) : (
          /** ยังไม่มีไฟล์: ปุ่มเลือกใหญ่ ๆ ปุ่มเดียว */
          <HubSettingsButton
            tone="secondary"
            icon={<Codicon name="add" />}
            title="เลือกไฟล์วิดีโอเปิด (MP4, MOV, MKV หรือ WEBM)"
            disabled={busy}
            onClick={() => void job.chooseIntro()}
          >
            เพิ่มวิดีโอเปิด
          </HubSettingsButton>
        )}
      </HubSettingsSection>

      {/* ─── 4. ผลลัพธ์ ────────────────────────────────────────── */}
      <HubSettingsSection
        icon={<Codicon name="output" />}
        title="ที่บันทึกวิดีโอ"
        step={4}
        description="ตั้งโฟลเดอร์ปลายทาง + คำนำหน้าชื่อไฟล์ (ระบบจะเติมเลขตอนต่อท้ายให้)"
      >
        <div className="space-y-3">
          <HubSettingsField label="โฟลเดอร์ปลายทาง">
            <HubSettingsFolderPicker
              icon={<Codicon name="folder-active" />}
              label="ปลายทาง"
              value={toRel(outputFolder)}
              onChange={(rel) => setOutputFolder(toAbs(rel))}
              options={folderOptions}
              onBrowse={() => job.chooseFolder(setOutputFolder)}
              onReload={() => reloadProjectFolders()}
              onOpen={outputFolder ? () => openFolder(outputFolder) : undefined}
              placeholder="ยังไม่ได้เลือกโฟลเดอร์…"
            />
          </HubSettingsField>

          <HubSettingsField
            label="คำนำหน้าชื่อไฟล์"
            hint='เช่นพิมพ์ "ตอนที่ " → ระบบจะตั้งชื่อ "ตอนที่ 1.mp4", "ตอนที่ 2.mp4"…'
          >
            <HubSettingsInput
              value={titlePrefix}
              onChange={(e) => setTitlePrefix(e.target.value)}
              disabled={busy}
              placeholder="เว้นว่าง = ใช้ชื่อเดียวกับไฟล์เสียง"
            />
          </HubSettingsField>
        </div>
      </HubSettingsSection>
    </div>
  )
}
