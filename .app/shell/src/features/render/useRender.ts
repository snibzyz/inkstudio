/**
 * useRender — zustand store ของโมดูล "เรนเดอร์คลิป"
 *
 * เก็บ:
 *   - source         coverPath | coverFolder, audioFolder, outputFolder, titlePrefix, useMultipleCovers
 *   - encoding       encodeOption, crfValue, resolutionLabel
 *   - files          audioFiles (list จาก IPC), selectedAudioFiles (Set)
 *   - presets        machinePreset (กาก/กลาง/เทพ) + custom presets ใน localStorage
 *   - job            busy/progress/current/total/message/error/summary/logs
 *
 * IPC: useRender ไม่เรียก IPC เอง — actions ใน UI เรียกผ่าน window.inkstudio.render.*
 *      แล้ว set state กลับ
 */

import { create } from 'zustand'

const STORAGE_KEY = 'inkstudio:render:v1'
const PRESETS_KEY = 'inkstudio:render-presets:v1'

export type EncodeOption = 'NVENC (H.264)' | 'NVENC (H.265)' | 'Software (H.264)'
export type Resolution = '480p' | '720p' | '1080p'
export type MachinePreset = 'weak' | 'medium' | 'strong'

export const RESOLUTIONS: ReadonlyArray<{ value: Resolution; label: string; hint: string }> = [
  { value: '480p', label: '480p', hint: 'ประหยัด' },
  { value: '720p', label: '720p', hint: 'มาตรฐาน' },
  { value: '1080p', label: '1080p', hint: 'คมชัด' },
]

export const ENCODERS: ReadonlyArray<{ value: EncodeOption; label: string; hint: string }> = [
  { value: 'NVENC (H.264)', label: 'NVENC H.264', hint: 'GPU NVIDIA — เร็ว' },
  { value: 'NVENC (H.265)', label: 'NVENC H.265', hint: 'GPU NVIDIA — ไฟล์เล็ก' },
  { value: 'Software (H.264)', label: 'Software H.264', hint: 'CPU — รันได้ทุกเครื่อง' },
]

export const MACHINE_PRESETS: Record<
  MachinePreset,
  { label: string; sublabel: string; encodeOption: EncodeOption; crf: number; resolution: Resolution; desc: string }
> = {
  weak: {
    label: 'คอมกาก',
    sublabel: 'ใช้ทรัพยากรน้อย',
    encodeOption: 'Software (H.264)',
    crf: 30,
    resolution: '480p',
    desc: 'CRF 30 · 480p · CPU — แล็ปท็อปไม่มี GPU ก็ได้',
  },
  medium: {
    label: 'คอมกลาง',
    sublabel: 'สมดุล',
    encodeOption: 'Software (H.264)',
    crf: 26,
    resolution: '720p',
    desc: 'CRF 26 · 720p · CPU — เครื่องทั่วไป',
  },
  strong: {
    label: 'คอมเทพ',
    sublabel: 'GPU',
    encodeOption: 'NVENC (H.264)',
    crf: 22,
    resolution: '1080p',
    desc: 'CRF 22 · 1080p · NVENC — มี GPU NVIDIA',
  },
}

export type RenderProgress = {
  progress: number
  current: number
  total: number
  fileName: string
  message: string
  currentTimeText: string
  durationText: string
}

export type RenderPersisted = {
  encodeOption: EncodeOption
  crfValue: number
  resolutionLabel: Resolution
  selectedMachinePreset: MachinePreset | null
  titlePrefix: string
  useMultipleCovers: boolean
}

export type RenderPreset = {
  coverPath: string
  coverFolder: string
  useMultipleCovers: boolean
  audioFolder: string
  outputFolder: string
  titlePrefix: string
  encodeOption: EncodeOption
  crfValue: number
  resolutionLabel: Resolution
}

type RenderJob = {
  busy: boolean
  jobId: string | null
  progress: number
  current: number
  total: number
  message: string
  error: string | null
  fileName: string
  currentTimeText: string
  durationText: string
  logs: string[]
  summary: {
    successCount: number
    totalFiles: number
    elapsedSeconds: number
    skippedCount: number
    missingCovers: string[]
  } | null
}

type State = {
  // source
  coverPath: string
  coverFolder: string
  useMultipleCovers: boolean
  audioFolder: string
  outputFolder: string
  titlePrefix: string

  // encoding
  encodeOption: EncodeOption
  crfValue: number
  resolutionLabel: Resolution
  selectedMachinePreset: MachinePreset | null

  // files
  audioFiles: string[]
  audioSearch: string
  selectedAudioFiles: Set<string>

  // presets
  presets: Record<string, RenderPreset>
  selectedPresetName: string
  presetNameInput: string

  // job
  job: RenderJob

  // ffmpeg
  ffmpeg: { ok: boolean; version: string; path: string; checked: boolean }

  setCoverPath: (v: string) => void
  setCoverFolder: (v: string) => void
  setUseMultipleCovers: (v: boolean) => void
  setAudioFolder: (v: string) => void
  setOutputFolder: (v: string) => void
  setTitlePrefix: (v: string) => void
  setEncodeOption: (v: EncodeOption) => void
  setCrfValue: (v: number) => void
  setResolutionLabel: (v: Resolution) => void
  applyMachinePreset: (key: MachinePreset) => void
  setAudioFiles: (v: string[]) => void
  setAudioSearch: (v: string) => void
  toggleAudioFile: (file: string) => void
  selectAllAudio: () => void
  clearAudioSelection: () => void

  savePreset: (name: string) => void
  loadPreset: (name: string) => void
  deletePreset: (name: string) => void
  setSelectedPresetName: (name: string) => void
  setPresetNameInput: (v: string) => void

  setJob: (patch: Partial<RenderJob>) => void
  resetJob: () => void
  appendLog: (line: string) => void

  setFfmpeg: (v: { ok: boolean; version?: string; path?: string }) => void
}

const DEFAULT_ENCODE: EncodeOption = 'Software (H.264)'
const DEFAULT_CRF = 26
const DEFAULT_RES: Resolution = '720p'

function loadPersisted(): Partial<RenderPersisted> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistOptions(s: State) {
  try {
    if (typeof localStorage === 'undefined') return
    const data: RenderPersisted = {
      encodeOption: s.encodeOption,
      crfValue: s.crfValue,
      resolutionLabel: s.resolutionLabel,
      selectedMachinePreset: s.selectedMachinePreset,
      titlePrefix: s.titlePrefix,
      useMultipleCovers: s.useMultipleCovers,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function loadPresets(): Record<string, RenderPreset> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistPresets(presets: Record<string, RenderPreset>) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
}

function matchMachinePreset(enc: EncodeOption, crf: number, res: Resolution): MachinePreset | null {
  for (const k of Object.keys(MACHINE_PRESETS) as MachinePreset[]) {
    const p = MACHINE_PRESETS[k]
    if (p.encodeOption === enc && p.crf === crf && p.resolution === res) return k
  }
  return null
}

const persisted = loadPersisted()

export const useRender = create<State>((set, get) => {
  const snapshot = () => persistOptions(get())
  return {
    coverPath: '',
    coverFolder: '',
    useMultipleCovers: persisted.useMultipleCovers ?? false,
    audioFolder: '',
    outputFolder: '',
    titlePrefix: persisted.titlePrefix ?? '',

    encodeOption: (persisted.encodeOption as EncodeOption) ?? DEFAULT_ENCODE,
    crfValue: typeof persisted.crfValue === 'number' ? persisted.crfValue : DEFAULT_CRF,
    resolutionLabel: (persisted.resolutionLabel as Resolution) ?? DEFAULT_RES,
    selectedMachinePreset: persisted.selectedMachinePreset ?? null,

    audioFiles: [],
    audioSearch: '',
    selectedAudioFiles: new Set(),

    presets: loadPresets(),
    selectedPresetName: '',
    presetNameInput: '',

    job: {
      busy: false,
      jobId: null,
      progress: 0,
      current: 0,
      total: 0,
      message: '',
      error: null,
      fileName: '',
      currentTimeText: '',
      durationText: '',
      logs: [],
      summary: null,
    },

    ffmpeg: { ok: false, version: '', path: '', checked: false },

    setCoverPath: (v) => set({ coverPath: v }),
    setCoverFolder: (v) => set({ coverFolder: v }),
    setUseMultipleCovers: (v) => {
      set({ useMultipleCovers: v })
      snapshot()
    },
    setAudioFolder: (v) => set({ audioFolder: v }),
    setOutputFolder: (v) => set({ outputFolder: v }),
    setTitlePrefix: (v) => {
      set({ titlePrefix: v })
      snapshot()
    },

    setEncodeOption: (v) => {
      set((s) => ({ encodeOption: v, selectedMachinePreset: matchMachinePreset(v, s.crfValue, s.resolutionLabel) }))
      snapshot()
    },
    setCrfValue: (v) => {
      set((s) => ({ crfValue: v, selectedMachinePreset: matchMachinePreset(s.encodeOption, v, s.resolutionLabel) }))
      snapshot()
    },
    setResolutionLabel: (v) => {
      set((s) => ({ resolutionLabel: v, selectedMachinePreset: matchMachinePreset(s.encodeOption, s.crfValue, v) }))
      snapshot()
    },
    applyMachinePreset: (key) => {
      const p = MACHINE_PRESETS[key]
      if (!p) return
      set({
        encodeOption: p.encodeOption,
        crfValue: p.crf,
        resolutionLabel: p.resolution,
        selectedMachinePreset: key,
      })
      snapshot()
    },

    setAudioFiles: (v) => {
      set((s) => {
        // รักษา selection ที่ยังอยู่ใน list
        const next = new Set<string>()
        for (const f of s.selectedAudioFiles) if (v.includes(f)) next.add(f)
        if (next.size === 0) for (const f of v) next.add(f)
        return { audioFiles: v, selectedAudioFiles: next }
      })
    },
    setAudioSearch: (v) => set({ audioSearch: v }),
    toggleAudioFile: (file) =>
      set((s) => {
        const next = new Set(s.selectedAudioFiles)
        if (next.has(file)) next.delete(file)
        else next.add(file)
        return { selectedAudioFiles: next }
      }),
    selectAllAudio: () => set((s) => ({ selectedAudioFiles: new Set(s.audioFiles) })),
    clearAudioSelection: () => set({ selectedAudioFiles: new Set() }),

    savePreset: (name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const s = get()
      const next = {
        ...s.presets,
        [trimmed]: {
          coverPath: s.coverPath,
          coverFolder: s.coverFolder,
          useMultipleCovers: s.useMultipleCovers,
          audioFolder: s.audioFolder,
          outputFolder: s.outputFolder,
          titlePrefix: s.titlePrefix,
          encodeOption: s.encodeOption,
          crfValue: s.crfValue,
          resolutionLabel: s.resolutionLabel,
        },
      }
      persistPresets(next)
      set({ presets: next, selectedPresetName: trimmed, presetNameInput: '' })
    },
    loadPreset: (name) => {
      const s = get()
      const p = s.presets[name]
      if (!p) return
      set({
        coverPath: p.coverPath,
        coverFolder: p.coverFolder,
        useMultipleCovers: p.useMultipleCovers,
        audioFolder: p.audioFolder,
        outputFolder: p.outputFolder,
        titlePrefix: p.titlePrefix,
        encodeOption: p.encodeOption,
        crfValue: p.crfValue,
        resolutionLabel: p.resolutionLabel,
        selectedMachinePreset: matchMachinePreset(p.encodeOption, p.crfValue, p.resolutionLabel),
        selectedPresetName: name,
      })
      snapshot()
    },
    deletePreset: (name) => {
      const s = get()
      if (!s.presets[name]) return
      const next = { ...s.presets }
      delete next[name]
      persistPresets(next)
      set({ presets: next, selectedPresetName: s.selectedPresetName === name ? '' : s.selectedPresetName })
    },
    setSelectedPresetName: (name) => set({ selectedPresetName: name }),
    setPresetNameInput: (v) => set({ presetNameInput: v }),

    setJob: (patch) => set((s) => ({ job: { ...s.job, ...patch } })),
    resetJob: () =>
      set({
        job: {
          busy: false,
          jobId: null,
          progress: 0,
          current: 0,
          total: 0,
          message: '',
          error: null,
          fileName: '',
          currentTimeText: '',
          durationText: '',
          logs: [],
          summary: null,
        },
      }),
    appendLog: (line) =>
      set((s) => {
        const last = s.job.logs[s.job.logs.length - 1]
        if (!line || line === last) return {}
        const next = [...s.job.logs, line]
        return { job: { ...s.job, logs: next.length > 200 ? next.slice(next.length - 200) : next } }
      }),

    setFfmpeg: (v) =>
      set({
        ffmpeg: {
          ok: !!v.ok,
          version: v.version ?? '',
          path: v.path ?? '',
          checked: true,
        },
      }),
  }
})

export { matchMachinePreset }
