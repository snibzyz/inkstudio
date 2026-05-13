import { useEffect, useRef, useState } from 'react'
import { AppButton, Codicon, MacFieldLabel, MacPanel } from '../../ui'
import { useStudio } from '../../state/useStudio'
import { useApp } from '../../state/useApp'
import { ModuleShell, type ModuleSection } from '../shared/ModuleShell'
import {
  ENCODERS,
  MACHINE_PRESETS,
  RESOLUTIONS,
  useRender,
  type EncodeOption,
  type MachinePreset,
  type Resolution,
} from './useRender'

type SectionId = 'overview' | 'source' | 'encoding' | 'presets' | 'files' | 'progress'

const SECTIONS: ReadonlyArray<ModuleSection<SectionId>> = [
  { id: 'overview', label: 'ภาพรวม', icon: 'dashboard' },
  { id: 'source', label: 'แหล่งข้อมูล', icon: 'folder-opened', step: 1 },
  { id: 'encoding', label: 'การเข้ารหัส', icon: 'settings-gear', step: 2 },
  { id: 'presets', label: 'พรีเซ็ต', icon: 'device-desktop', step: 3 },
  { id: 'files', label: 'ไฟล์เสียง', icon: 'music', step: 4 },
  { id: 'progress', label: 'เรนเดอร์', icon: 'play-circle', step: 5 },
]

export function RenderModule() {
  const [active, setActive] = useState<SectionId>('overview')
  const job = useRender((s) => s.job)
  const audioFiles = useRender((s) => s.audioFiles)
  const selectedAudio = useRender((s) => s.selectedAudioFiles)
  const ffmpeg = useRender((s) => s.ffmpeg)
  const setFfmpeg = useRender((s) => s.setFfmpeg)
  const setJob = useRender((s) => s.setJob)
  const appendLog = useRender((s) => s.appendLog)

  /** ตรวจ FFmpeg + subscribe progress event ตอน mount */
  useEffect(() => {
    let off: (() => void) | undefined
    const r = window.inkstudio?.render
    if (r?.checkFfmpeg) {
      void r.checkFfmpeg().then(setFfmpeg)
    }
    if (r?.onProgress) {
      off = r.onProgress((payload) => {
        if (!payload) return
        if (payload.summary) {
          setJob({ summary: payload.summary, progress: 1, busy: false, message: 'เสร็จสมบูรณ์' })
          return
        }
        setJob({
          progress: payload.progress ?? 0,
          fileName: payload.fileName ?? '',
          currentTimeText: payload.currentTimeText ?? '',
          durationText: payload.durationText ?? '',
          message: payload.message ?? '',
        })
        if (payload.message) appendLog(payload.message)
      })
    }
    return () => off?.()
  }, [setFfmpeg, setJob, appendLog])

  const sections = SECTIONS.map((s) => {
    if (s.id === 'files' && audioFiles.length > 0) {
      return { ...s, badge: `${selectedAudio.size}/${audioFiles.length}` }
    }
    if (s.id === 'progress' && job.busy) {
      return { ...s, badge: `${Math.round(job.progress * 100)}%` }
    }
    return s
  })

  return (
    <ModuleShell
      icon="device-camera-video"
      title="เรนเดอร์คลิป"
      subtitle={
        ffmpeg.checked
          ? ffmpeg.ok
            ? `FFmpeg ${ffmpeg.version} · พรีเซ็ตคอม กาก/กลาง/เทพ`
            : 'FFmpeg ไม่พร้อม — ดูแท็บภาพรวม'
          : 'กำลังตรวจ FFmpeg...'
      }
      sections={sections}
      activeSection={active}
      onSectionChange={setActive}
      preview={<RenderPreviewPane />}
    >
      {active === 'overview' && <OverviewSection />}
      {active === 'source' && <SourceSection />}
      {active === 'encoding' && <EncodingSection />}
      {active === 'presets' && <PresetsSection />}
      {active === 'files' && <FilesSection />}
      {active === 'progress' && <ProgressSection />}
    </ModuleShell>
  )
}

function OverviewSection() {
  const ffmpeg = useRender((s) => s.ffmpeg)
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="info" className="mr-1.5" />
        ภาพรวมโมดูลเรนเดอร์
      </h3>
      <p className="text-[12px] leading-relaxed text-vscode-fg-dim">
        เรนเดอร์คลิป mp4 จาก (ปก + ไฟล์เสียง) เป็นชุดผ่าน FFmpeg ในตัวแอป (bundle แล้ว — user ไม่ต้องลงเอง):
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-vscode-fg-dim">
        <li>เลือกปก (เดี่ยวจากทำปกล่าสุด หรือโฟลเดอร์ปกหลายไฟล์)</li>
        <li>เลือกโฟลเดอร์เสียงที่ INKTTS ผลิตไว้</li>
        <li>เลือก encoder + CRF + resolution (หรือใช้ machine preset)</li>
        <li>เลือกไฟล์เสียงที่จะเรนเดอร์</li>
        <li>กด "เริ่มเรนเดอร์" — ดู progress real-time</li>
      </ol>

      <div
        className={`rounded-sm border p-2 text-[11px] ${
          ffmpeg.checked
            ? ffmpeg.ok
              ? 'border-vscode-success/40 bg-vscode-success/10 text-vscode-success'
              : 'border-vscode-error/40 bg-vscode-error-bg/40 text-vscode-error'
            : 'border-vscode-border bg-vscode-input/30 text-vscode-muted'
        }`}
      >
        {ffmpeg.checked ? (
          ffmpeg.ok ? (
            <>
              <Codicon name="check" /> FFmpeg พร้อม — version {ffmpeg.version}
              <div className="mt-1 truncate text-[10px] text-vscode-fg-dim">{ffmpeg.path}</div>
            </>
          ) : (
            <>
              <Codicon name="error" /> FFmpeg ไม่พร้อม — ต้อง rebuild แอป
            </>
          )
        ) : (
          <>
            <Codicon name="loading" spin /> กำลังตรวจ FFmpeg...
          </>
        )}
      </div>
    </MacPanel>
  )
}

function SourceSection() {
  const useMulti = useRender((s) => s.useMultipleCovers)
  const setUseMulti = useRender((s) => s.setUseMultipleCovers)
  const coverPath = useRender((s) => s.coverPath)
  const setCoverPath = useRender((s) => s.setCoverPath)
  const coverFolder = useRender((s) => s.coverFolder)
  const setCoverFolder = useRender((s) => s.setCoverFolder)
  const audioFolder = useRender((s) => s.audioFolder)
  const setAudioFolder = useRender((s) => s.setAudioFolder)
  const outputFolder = useRender((s) => s.outputFolder)
  const setOutputFolder = useRender((s) => s.setOutputFolder)
  const titlePrefix = useRender((s) => s.titlePrefix)
  const setTitlePrefix = useRender((s) => s.setTitlePrefix)
  const setAudioFiles = useRender((s) => s.setAudioFiles)

  const coverOutput = useStudio((s) => s.coverOutput)
  const goToCover = useApp((s) => s.setActiveModule)

  async function pickFile(setter: (v: string) => void, filters?: Array<{ name: string; extensions: string[] }>) {
    const p = await window.inkstudio?.fs?.chooseFile?.({ filters })
    if (typeof p === 'string') setter(p)
  }
  async function pickFolder(setter: (v: string) => void) {
    const p = await window.inkstudio?.fs?.chooseFolder?.()
    if (typeof p === 'string') setter(p)
  }
  async function refreshAudio(folder: string) {
    if (!folder) {
      setAudioFiles([])
      return
    }
    const files = (await window.inkstudio?.render?.listAudioFiles?.(folder)) ?? []
    setAudioFiles(files)
  }

  function applyCoverSync() {
    if (!coverOutput) return
    const target = coverOutput.kind === 'folder' ? coverOutput.folderPath : coverOutput.filePath
    if (!target) return
    if (coverOutput.kind === 'folder') {
      setUseMulti(true)
      setCoverFolder(target)
    } else {
      setUseMulti(false)
      setCoverPath(target)
    }
  }

  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="folder-opened" className="mr-1.5" />
        แหล่งข้อมูล
      </h3>

      {coverOutput ? (
        <div className="rounded-sm border border-vscode-brand/40 bg-vscode-brand/10 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-vscode-brand">
            <Codicon name="sync" />
            Sync จากโมดูลทำปก
          </div>
          <div className="mb-2 text-[11px] leading-relaxed text-vscode-fg-dim">
            ปกล่าสุด ({coverOutput.kind === 'folder' ? 'โฟลเดอร์' : 'ไฟล์เดี่ยว'}):{' '}
            <code className="rounded-sm bg-vscode-input/60 px-1">
              {coverOutput.kind === 'folder' ? coverOutput.folderPath : coverOutput.filePath}
            </code>
          </div>
          <div className="flex gap-1.5">
            <AppButton tone="primary" variant="flat" onPress={applyCoverSync}>
              <Codicon name="check" />
              ใช้ปกล่าสุด
            </AppButton>
            <AppButton tone="zinc" variant="flat" onPress={() => goToCover('cover')}>
              <Codicon name="arrow-left" />
              กลับไปทำปก
            </AppButton>
          </div>
        </div>
      ) : null}

      <div>
        <MacFieldLabel>โหมดปก</MacFieldLabel>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setUseMulti(false)}
            className={`h-8 flex-1 rounded-sm border text-[12px] ${
              !useMulti
                ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
            }`}
          >
            ปกเดียวทุกตอน
          </button>
          <button
            type="button"
            onClick={() => setUseMulti(true)}
            className={`h-8 flex-1 rounded-sm border text-[12px] ${
              useMulti
                ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
            }`}
          >
            ปกแยกต่อตอน (match ตามชื่อไฟล์)
          </button>
        </div>
      </div>

      {useMulti ? (
        <SourceField
          label="โฟลเดอร์ปก (ชื่อตรงกับไฟล์เสียง)"
          value={coverFolder}
          onChange={setCoverFolder}
          onBrowse={() => pickFolder(setCoverFolder)}
        />
      ) : (
        <SourceField
          label="ไฟล์ปก (ใช้กับทุกตอน)"
          value={coverPath}
          onChange={setCoverPath}
          onBrowse={() =>
            pickFile(setCoverPath, [{ name: 'รูปภาพ', extensions: ['png', 'jpg', 'jpeg'] }])
          }
        />
      )}

      <SourceField
        label="โฟลเดอร์ไฟล์เสียง"
        value={audioFolder}
        onChange={setAudioFolder}
        onBrowse={async () => {
          const p = await window.inkstudio?.fs?.chooseFolder?.()
          if (typeof p === 'string') {
            setAudioFolder(p)
            await refreshAudio(p)
          }
        }}
        rightAction={
          audioFolder ? (
            <button
              type="button"
              title="รีเฟรชรายการไฟล์เสียง"
              onClick={() => void refreshAudio(audioFolder)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-vscode-border bg-vscode-button text-vscode-fg hover:bg-vscode-button-hover"
            >
              <Codicon name="refresh" />
            </button>
          ) : null
        }
      />
      <SourceField
        label="โฟลเดอร์ปลายทาง (.mp4)"
        value={outputFolder}
        onChange={setOutputFolder}
        onBrowse={() => pickFolder(setOutputFolder)}
      />
      <div>
        <MacFieldLabel>คำนำหน้าชื่อไฟล์ผลลัพธ์</MacFieldLabel>
        <input
          value={titlePrefix}
          onChange={(e) => setTitlePrefix(e.target.value)}
          placeholder='เช่น "EP-"'
          className="h-8 w-full rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
        />
      </div>
    </MacPanel>
  )
}

function EncodingSection() {
  const encodeOption = useRender((s) => s.encodeOption)
  const setEncodeOption = useRender((s) => s.setEncodeOption)
  const crfValue = useRender((s) => s.crfValue)
  const setCrfValue = useRender((s) => s.setCrfValue)
  const resolution = useRender((s) => s.resolutionLabel)
  const setResolution = useRender((s) => s.setResolutionLabel)
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="settings-gear" className="mr-1.5" />
        การเข้ารหัส
      </h3>
      <div>
        <MacFieldLabel>Encoder</MacFieldLabel>
        <div className="flex flex-col gap-1">
          {ENCODERS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setEncodeOption(e.value as EncodeOption)}
              className={`flex items-center justify-between rounded-sm border px-2 py-1.5 text-left text-[12px] ${
                encodeOption === e.value
                  ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                  : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
              }`}
            >
              <span>{e.label}</span>
              <span className="text-[10px] text-vscode-muted">{e.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-vscode-fg-dim">
          <span>CRF (18 = ดีสุด, 30 = ประหยัด)</span>
          <span className="tabular-nums text-vscode-muted">{crfValue}</span>
        </div>
        <input
          type="range"
          min={18}
          max={30}
          value={crfValue}
          onChange={(e) => setCrfValue(Number(e.target.value))}
          className="h-8 w-full accent-vscode-brand"
        />
      </div>
      <div>
        <MacFieldLabel>Resolution</MacFieldLabel>
        <div className="flex gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setResolution(r.value as Resolution)}
              className={`h-8 flex-1 rounded-sm border text-[12px] ${
                resolution === r.value
                  ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                  : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
              }`}
              title={r.hint}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </MacPanel>
  )
}

function PresetsSection() {
  const presets = useRender((s) => s.presets)
  const selectedPresetName = useRender((s) => s.selectedPresetName)
  const setSelectedPresetName = useRender((s) => s.setSelectedPresetName)
  const presetNameInput = useRender((s) => s.presetNameInput)
  const setPresetNameInput = useRender((s) => s.setPresetNameInput)
  const savePreset = useRender((s) => s.savePreset)
  const loadPreset = useRender((s) => s.loadPreset)
  const deletePreset = useRender((s) => s.deletePreset)
  const applyMachinePreset = useRender((s) => s.applyMachinePreset)
  const selectedMachine = useRender((s) => s.selectedMachinePreset)
  const presetNames = Object.keys(presets).sort()
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="device-desktop" className="mr-1.5" />
        พรีเซ็ต
      </h3>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-vscode-muted">
        Machine preset (สเปคเครื่อง)
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(MACHINE_PRESETS) as MachinePreset[]).map((k) => {
          const p = MACHINE_PRESETS[k]
          const active = selectedMachine === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => applyMachinePreset(k)}
              className={`flex flex-col items-start gap-0.5 rounded-sm border px-2 py-1.5 text-left ${
                active
                  ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                  : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
              }`}
              title={p.desc}
            >
              <span className="text-[12px] font-medium text-vscode-fg">{p.label}</span>
              <span className="text-[10px] text-vscode-muted">{p.sublabel}</span>
              <span className="text-[10px] text-vscode-muted">{p.crf} · {p.resolution}</span>
            </button>
          )
        })}
      </div>

      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-vscode-muted">
        Custom preset (เก็บ source paths + encoding)
      </div>
      <div className="flex gap-1">
        <input
          value={presetNameInput}
          onChange={(e) => setPresetNameInput(e.target.value)}
          placeholder="ชื่อพรีเซ็ตใหม่..."
          className="h-8 flex-1 rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
        />
        <AppButton
          tone="primary"
          variant="flat"
          disabled={!presetNameInput.trim()}
          onPress={() => savePreset(presetNameInput)}
        >
          <Codicon name="save" />
          บันทึก
        </AppButton>
      </div>
      {presetNames.length === 0 ? (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-3 text-[11px] text-vscode-muted">
          ยังไม่มีพรีเซ็ต — ตั้งชื่อแล้วกด "บันทึก"
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {presetNames.map((n) => (
            <li
              key={n}
              className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 text-[12px] ${
                selectedPresetName === n
                  ? 'border-vscode-brand/40 bg-vscode-brand/10 text-vscode-fg-bright'
                  : 'border-vscode-border bg-transparent text-vscode-fg'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedPresetName(n)}
                className="flex-1 truncate text-left"
              >
                {n}
              </button>
              <button
                type="button"
                onClick={() => loadPreset(n)}
                className="rounded-sm border border-vscode-border bg-vscode-button px-2 py-0.5 text-[11px] hover:bg-vscode-button-hover"
              >
                โหลด
              </button>
              <button
                type="button"
                onClick={() => deletePreset(n)}
                className="rounded-sm border border-vscode-error/40 bg-transparent px-2 py-0.5 text-[11px] text-vscode-error hover:bg-vscode-error/10"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}
    </MacPanel>
  )
}

function FilesSection() {
  const audioFiles = useRender((s) => s.audioFiles)
  const selected = useRender((s) => s.selectedAudioFiles)
  const search = useRender((s) => s.audioSearch)
  const setSearch = useRender((s) => s.setAudioSearch)
  const toggle = useRender((s) => s.toggleAudioFile)
  const selectAll = useRender((s) => s.selectAllAudio)
  const clearSel = useRender((s) => s.clearAudioSelection)
  const filtered = audioFiles.filter((f) => (search ? f.toLowerCase().includes(search.toLowerCase()) : true))
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="music" className="mr-1.5" />
        ไฟล์เสียง — {selected.size}/{audioFiles.length}
      </h3>
      {audioFiles.length === 0 ? (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-3 text-[11px] text-vscode-muted">
          ยังไม่มีไฟล์ — ไปแท็บ <span className="text-vscode-fg">แหล่งข้อมูล</span> แล้วเลือกโฟลเดอร์ไฟล์เสียง
        </div>
      ) : (
        <>
          <div className="flex gap-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา..."
              className="h-8 flex-1 rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
            />
            <AppButton tone="zinc" variant="flat" onPress={selectAll}>
              เลือกทั้งหมด
            </AppButton>
            <AppButton tone="zinc" variant="flat" onPress={clearSel}>
              ล้าง
            </AppButton>
          </div>
          <ul className="flex max-h-[40vh] flex-col gap-0.5 overflow-auto rounded-sm border border-vscode-border bg-vscode-input/20 p-1">
            {filtered.map((f) => (
              <li key={f}>
                <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-[12px] hover:bg-vscode-list-hover">
                  <input
                    type="checkbox"
                    checked={selected.has(f)}
                    onChange={() => toggle(f)}
                    className="accent-vscode-brand"
                  />
                  <span className="min-w-0 flex-1 truncate text-vscode-fg">{f}</span>
                </label>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="p-2 text-[11px] text-vscode-muted">— ไม่พบไฟล์ตามคำค้น —</li>
            ) : null}
          </ul>
        </>
      )}
    </MacPanel>
  )
}

function ProgressSection() {
  const job = useRender((s) => s.job)
  const setJob = useRender((s) => s.setJob)
  const resetJob = useRender((s) => s.resetJob)
  const ffmpeg = useRender((s) => s.ffmpeg)
  const cancelRef = useRef<string | null>(null)

  const state = useRender.getState

  async function startRender() {
    const s = state()
    if (!ffmpeg.ok) {
      setJob({ error: 'FFmpeg ไม่พร้อม' })
      return
    }
    if (s.useMultipleCovers ? !s.coverFolder : !s.coverPath) {
      setJob({ error: 'กรุณาเลือกปก' })
      return
    }
    if (!s.audioFolder || s.selectedAudioFiles.size === 0) {
      setJob({ error: 'กรุณาเลือกโฟลเดอร์เสียง + ไฟล์อย่างน้อย 1 ไฟล์' })
      return
    }
    if (!s.outputFolder) {
      setJob({ error: 'กรุณาเลือกโฟลเดอร์ปลายทาง' })
      return
    }
    const jobId = `job-${Date.now()}`
    cancelRef.current = jobId
    resetJob()
    setJob({
      busy: true,
      jobId,
      message: 'กำลังเริ่ม...',
      total: s.selectedAudioFiles.size,
      current: 0,
    })
    try {
      const summary = await window.inkstudio!.render!.startBatch({
        jobId,
        coverPath: s.coverPath,
        coverFolder: s.coverFolder,
        useMultipleCovers: s.useMultipleCovers,
        audioFolder: s.audioFolder,
        selectedAudioFiles: Array.from(s.selectedAudioFiles),
        outputFolder: s.outputFolder,
        titlePrefix: s.titlePrefix,
        encodeOption: s.encodeOption,
        crfValue: s.crfValue,
        resolutionLabel: s.resolutionLabel,
        overwriteMode: 'skip',
      })
      setJob({ busy: false, summary, progress: 1, message: 'เสร็จสมบูรณ์' })
    } catch (err) {
      setJob({
        busy: false,
        error: err instanceof Error ? err.message : String(err),
        message: 'หยุดการทำงาน',
      })
    }
  }

  async function cancelRender() {
    if (!cancelRef.current) return
    await window.inkstudio?.render?.cancelJob?.(cancelRef.current)
    setJob({ busy: false, message: 'ยกเลิกแล้ว' })
  }

  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="play-circle" className="mr-1.5" />
        เรนเดอร์
      </h3>

      {job.error ? (
        <div role="alert" className="rounded-sm border border-vscode-error/40 bg-vscode-error-bg/40 p-2 text-[11px] text-vscode-error">
          {job.error}
        </div>
      ) : null}

      {job.busy || job.progress > 0 || job.message ? (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-2 text-[11px] text-vscode-fg-dim">
          <div className="flex items-center justify-between">
            <span className="truncate">{job.message || 'พร้อมทำงาน'}</span>
            <span className="tabular-nums text-vscode-muted">
              {job.currentTimeText && job.durationText
                ? `${job.currentTimeText} / ${job.durationText}`
                : `${job.current}/${job.total}`}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-vscode-input">
            <div
              className="h-full bg-vscode-brand transition-[width] duration-200"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
          {job.fileName ? (
            <div className="mt-1 truncate text-[10px] text-vscode-muted">{job.fileName}</div>
          ) : null}
        </div>
      ) : null}

      {job.summary ? (
        <div className="rounded-sm border border-vscode-success/40 bg-vscode-success/10 p-2 text-[11px] text-vscode-fg">
          <Codicon name="check" /> เสร็จ {job.summary.successCount}/{job.summary.totalFiles} ไฟล์
          {job.summary.skippedCount > 0 ? ` · ข้าม ${job.summary.skippedCount}` : ''}
          {job.summary.missingCovers.length > 0
            ? ` · ปกหายไป ${job.summary.missingCovers.length} ไฟล์`
            : ''}
          {` · ใช้เวลา ${Math.round(job.summary.elapsedSeconds)} วินาที`}
        </div>
      ) : null}

      <div className="flex gap-2">
        {job.busy ? (
          <AppButton tone="zinc" variant="flat" className="flex-1" onPress={() => void cancelRender()}>
            <Codicon name="stop-circle" />
            ยกเลิก
          </AppButton>
        ) : (
          <AppButton tone="primary" className="flex-1" onPress={() => void startRender()}>
            <Codicon name="play" />
            เริ่มเรนเดอร์
          </AppButton>
        )}
      </div>

      {job.logs.length > 0 ? (
        <details className="rounded-sm border border-vscode-border bg-vscode-input/30 p-2 text-[10px]">
          <summary className="cursor-pointer text-[11px] text-vscode-fg-dim">
            Log ({job.logs.length} บรรทัด)
          </summary>
          <pre className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-vscode-muted">
            {job.logs.slice(-50).join('\n')}
          </pre>
        </details>
      ) : null}
    </MacPanel>
  )
}

function RenderPreviewPane() {
  const job = useRender((s) => s.job)
  const selectedAudio = useRender((s) => s.selectedAudioFiles)
  const titlePrefix = useRender((s) => s.titlePrefix)
  const sampleFiles = Array.from(selectedAudio).slice(0, 6)
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-vscode-muted">คิว · ตัวอย่าง</div>
      <div className="relative mx-auto flex aspect-video w-full max-w-[320px] items-center justify-center rounded-sm border border-vscode-border bg-black shadow-mac">
        <div className="flex flex-col items-center gap-2 text-vscode-fg-dim">
          <Codicon name={job.busy ? 'loading' : 'device-camera-video'} spin={job.busy} size={32} />
          <span className="truncate px-3 text-center text-[11px]">
            {job.fileName || 'ยังไม่ได้เรนเดอร์'}
          </span>
          {job.currentTimeText && job.durationText ? (
            <span className="text-[10px] text-vscode-muted">
              {job.currentTimeText} / {job.durationText}
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-vscode-input">
          <div
            className="h-full rounded-full bg-vscode-brand transition-[width] duration-200"
            style={{ width: `${Math.round(job.progress * 100)}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] font-medium text-vscode-fg-dim">
          คิว ({selectedAudio.size} ไฟล์)
        </div>
        <ul className="flex flex-col gap-0.5 text-[11px] text-vscode-muted">
          {sampleFiles.length === 0 ? (
            <li className="rounded-sm border border-dashed border-vscode-border p-2 text-center text-vscode-muted/70">
              ยังไม่มีไฟล์ในคิว
            </li>
          ) : (
            sampleFiles.map((f) => (
              <li
                key={f}
                className="flex items-center gap-1.5 rounded-sm border border-vscode-border bg-vscode-editor/40 px-2 py-1"
              >
                <Codicon name="music" />
                <span className="min-w-0 flex-1 truncate text-vscode-fg-dim">{f}</span>
                <span className="text-[10px] text-vscode-muted">→ {titlePrefix}{f.replace(/\.[^.]+$/, '')}.mp4</span>
              </li>
            ))
          )}
          {selectedAudio.size > sampleFiles.length ? (
            <li className="px-2 text-[10px] text-vscode-muted/80">
              ...และอีก {selectedAudio.size - sampleFiles.length} ไฟล์
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function SourceField({
  label,
  value,
  onChange,
  onBrowse,
  rightAction,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBrowse: () => void | Promise<void>
  rightAction?: React.ReactNode
}) {
  return (
    <div>
      <MacFieldLabel>{label}</MacFieldLabel>
      <div className="flex gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="เลือก..."
          className="h-8 flex-1 rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
        />
        <button
          type="button"
          title="เลือก"
          onClick={() => void onBrowse()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-vscode-border bg-vscode-button text-vscode-fg hover:bg-vscode-button-hover"
        >
          <Codicon name="folder-opened" />
        </button>
        {rightAction}
      </div>
    </div>
  )
}
