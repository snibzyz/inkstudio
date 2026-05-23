/**
 * useRender — Zustand store ของแท็บ Render (เครื่องมือคลิป)
 *
 * รับผิดชอบ:
 *   - state ของ Source (image/audio/output/cover/multi-cover/title)
 *   - state ของ Encoding (codec/CRF/resolution)
 *   - state ของ Presets (server-side preset map ของผู้ใช้)
 *   - state ของ Files (audio file list + search + selection)
 *   - state ของ Job (busy/error/status/progress/currentFile/eta/summary/logs)
 *   - actions พื้นฐาน setX + persist options
 *
 * Logic ที่ involve IPC (โหลด/บันทึก preset · scan audio folder · start/cancel render)
 *   อยู่ใน useRenderJob — store นี้เก็บ state slices ล้วน ๆ
 *
 * INKSTUDIO note: ไม่มี project folder concept — projectFolders เป็น [] ตลอด,
 * reloadProjectFolders เป็น no-op. UI dropdown จะแสดง empty + ต้องเลือก path ด้วย browse.
 */

import { create } from 'zustand'
import {
  DEFAULT_CRF,
  DEFAULT_ENCODE_OPTION,
  DEFAULT_RESOLUTION,
  LOG_BUFFER_LIMIT,
  STORAGE_KEY,
} from './renderConstants'
import type {
  BatchPreset,
  PersistedRenderOptions,
  PresetMap,
} from './renderTypes'

/** stub — INKSTUDIO ไม่มี project folder concept */
export type ProjectFolderOption = {
  rel: string
  label: string
}

function loadPersisted(): Partial<PersistedRenderOptions> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Partial<PersistedRenderOptions>
  } catch {
    return {}
  }
}

function persist(state: PersistedRenderOptions) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

type ScheduledPersist = ReturnType<typeof setTimeout> | null
let persistTimer: ScheduledPersist = null

function schedulePersist(snapshot: PersistedRenderOptions) {
  if (persistTimer !== null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persist(snapshot)
    persistTimer = null
  }, 120)
}

const persisted = loadPersisted()

export type RenderStoreState = {
  /** Source */
  imagePath: string
  audioFolder: string
  /** ปลายทางของไฟล์เสียงต้นทางหลังเรนเดอร์เสร็จ (Audio/processed) — ว่างได้ */
  audioProcessedFolder: string
  outputFolder: string
  coverFolder: string
  useMultipleCovers: boolean
  titlePrefix: string

  /** Intro (วิดีโอแทรกหน้าตอน) — `introPath` + `useIntro` persist ข้ามเซสชัน */
  introPath: string
  useIntro: boolean

  /** Encoding */
  encodeOption: string
  /** user เปลี่ยน encoder เองหรือยัง — กัน auto-detect แก้ทับ */
  encoderUserSet: boolean
  crfValue: number
  resolution: string

  /** Presets */
  presets: PresetMap
  selectedPresetName: string
  presetName: string

  /** Files */
  audioFiles: string[]
  audioSearch: string
  selectedAudioFiles: Set<string>

  /** Job */
  busy: boolean
  error: string | null
  status: string
  progress: number
  currentFile: string
  fileProgressText: string
  etaText: string
  summaryText: string
  logs: string[]

  /** มีโปรเจกต์ active ที่ apply path ไปแล้ว — กัน reset ซ้ำ */
  appliedProjectId: string | null

  /** workspace-rel root ของโปรเจกต์ active (INKSTUDIO ไม่มี — ว่าง) */
  projectRootRel: string

  /** รายการโฟลเดอร์ในโปรเจกต์สำหรับ HubSettingsFolderPicker dropdown
   *  INKSTUDIO ไม่มี project folder concept — ว่างตลอด */
  projectFolders: ProjectFolderOption[]

  /** reload รายการ projectFolders — INKSTUDIO no-op (ตั้งให้เป็น []) */
  reloadProjectFolders: () => Promise<void>

  /** Setters — Source */
  setImagePath: (v: string) => void
  setAudioFolder: (v: string) => void
  setOutputFolder: (v: string) => void
  setCoverFolder: (v: string) => void
  setUseMultipleCovers: (v: boolean) => void
  setTitlePrefix: (v: string) => void

  /** Setters — Intro (auto-persist) */
  setIntroPath: (v: string) => void
  setUseIntro: (v: boolean) => void

  /** Setters — Encoding (auto-persist)
   *  `auto: true` = system picker (e.g. probe result on mount). Does NOT
   *   flip `encoderUserSet` to true, so future probes can still update it. */
  setEncodeOption: (v: string, opts?: { auto?: boolean }) => void
  setCrfValue: (v: number) => void
  setResolution: (v: string) => void

  /** ใช้ค่า encoder ที่ระบบ auto-detect — apply เฉพาะกรณี user ยังไม่เคยเลือกเอง */
  applyDetectedEncoder: (v: string) => void

  /** Setters — Presets */
  setPresets: (v: PresetMap) => void
  setSelectedPresetName: (v: string) => void
  setPresetName: (v: string) => void

  /** Setters — Files */
  setAudioFiles: (v: string[]) => void
  setAudioSearch: (v: string) => void
  setSelectedAudioFiles: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void

  /** Setters — Job */
  setBusy: (v: boolean) => void
  setError: (v: string | null) => void
  setStatus: (v: string) => void
  setProgress: (v: number) => void
  setCurrentFile: (v: string) => void
  setFileProgressText: (v: string) => void
  setEtaText: (v: string) => void
  setSummaryText: (v: string) => void
  appendLog: (line: string) => void
  resetJob: () => void

  /** Apply BatchPreset (จาก preset server-side) — เซ็ตทุกฟิลด์ source/encoding */
  applyPreset: (preset: BatchPreset) => void

  /** ใช้ตอนสลับโปรเจกต์ — เคลียร์ queue/logs/error และ apply path ของโปรเจกต์ใหม่ */
  resetForActiveProject: (
    projectId: string | null,
    paths: {
      audioRaw?: string
      audioProcessed?: string
      renderOutput?: string
      covers?: string
    } | null
  ) => void

  /** เลือกทั้งหมด/ล้าง */
  selectAll: () => void
  clearSelection: () => void
  toggleAudioFile: (file: string) => void
}

export const useRender = create<RenderStoreState>((set, get) => {
  const initialEncode = typeof persisted.encodeOption === 'string' ? persisted.encodeOption : DEFAULT_ENCODE_OPTION
  const initialEncoderUserSet = typeof persisted.encoderUserSet === 'boolean' ? persisted.encoderUserSet : false
  const initialCrf = typeof persisted.crfValue === 'number' && Number.isFinite(persisted.crfValue) ? persisted.crfValue : DEFAULT_CRF
  const initialRes = typeof persisted.resolution === 'string' ? persisted.resolution : DEFAULT_RESOLUTION
  const initialIntroPath = typeof persisted.introPath === 'string' ? persisted.introPath : ''
  const initialUseIntro = typeof persisted.useIntro === 'boolean' ? persisted.useIntro : false
  const initialPresets = (persisted.presets && typeof persisted.presets === 'object') ? persisted.presets : {}

  const persistCurrent = () => {
    const s = get()
    schedulePersist({
      encodeOption: s.encodeOption,
      encoderUserSet: s.encoderUserSet,
      crfValue: s.crfValue,
      resolution: s.resolution,
      introPath: s.introPath,
      useIntro: s.useIntro,
      presets: s.presets,
    })
  }

  return {
    imagePath: '',
    audioFolder: '',
    audioProcessedFolder: '',
    outputFolder: '',
    coverFolder: '',
    useMultipleCovers: false,
    titlePrefix: '',

    introPath: initialIntroPath,
    useIntro: initialUseIntro,

    encodeOption: initialEncode,
    encoderUserSet: initialEncoderUserSet,
    crfValue: initialCrf,
    resolution: initialRes,

    presets: initialPresets,
    selectedPresetName: '',
    presetName: '',

    audioFiles: [],
    audioSearch: '',
    selectedAudioFiles: new Set(),

    busy: false,
    error: null,
    status: 'พร้อมทำงาน',
    progress: 0,
    currentFile: '',
    fileProgressText: '',
    etaText: '',
    summaryText: '',
    logs: [],

    appliedProjectId: null,

    projectRootRel: '',
    projectFolders: [],

    reloadProjectFolders: async () => {
      /** INKSTUDIO has no project folder concept — always empty */
      set({ projectFolders: [] })
    },

    setImagePath: (v) => set({ imagePath: v }),
    setAudioFolder: (v) => set({ audioFolder: v }),
    setOutputFolder: (v) => set({ outputFolder: v }),
    setCoverFolder: (v) => set({ coverFolder: v }),
    setUseMultipleCovers: (v) => set({ useMultipleCovers: v }),
    setTitlePrefix: (v) => set({ titlePrefix: v }),

    setIntroPath: (v) => { set({ introPath: v }); persistCurrent() },
    setUseIntro: (v) => { set({ useIntro: v }); persistCurrent() },

    setEncodeOption: (v, opts) => {
      /** user เลือกเอง = lock ค่านี้ไว้ ไม่ให้ auto-detect แก้ทับครั้งต่อไป
       *  opts.auto = true (system picker) → ไม่ flip flag, probe ถัดไปยัง override ได้ */
      if (opts?.auto) {
        set({ encodeOption: v })
      } else {
        set({ encodeOption: v, encoderUserSet: true })
      }
      persistCurrent()
    },
    setCrfValue: (v) => {
      set({ crfValue: v })
      persistCurrent()
    },
    setResolution: (v) => {
      set({ resolution: v })
      persistCurrent()
    },

    applyDetectedEncoder: (v) => {
      const s = get()
      /** ถ้า user ตั้งเองแล้ว = อย่าแก้ทับ */
      if (s.encoderUserSet) return
      if (s.encodeOption === v) return
      set({ encodeOption: v })
      persistCurrent()
    },

    setPresets: (v) => {
      set({ presets: v })
      persistCurrent()
    },
    setSelectedPresetName: (v) => set({ selectedPresetName: v }),
    setPresetName: (v) => set({ presetName: v }),

    setAudioFiles: (v) => set({ audioFiles: v }),
    setAudioSearch: (v) => set({ audioSearch: v }),
    setSelectedAudioFiles: (v) =>
      set((s) => ({ selectedAudioFiles: typeof v === 'function' ? v(s.selectedAudioFiles) : v })),

    setBusy: (v) => set({ busy: v }),
    setError: (v) => set({ error: v }),
    setStatus: (v) => set({ status: v }),
    setProgress: (v) => set({ progress: v }),
    setCurrentFile: (v) => set({ currentFile: v }),
    setFileProgressText: (v) => set({ fileProgressText: v }),
    setEtaText: (v) => set({ etaText: v }),
    setSummaryText: (v) => set({ summaryText: v }),
    appendLog: (line) =>
      set((s) => {
        if (!line) return {}
        if (s.logs[s.logs.length - 1] === line) return {}
        const next = [...s.logs, line]
        return { logs: next.length > LOG_BUFFER_LIMIT ? next.slice(next.length - LOG_BUFFER_LIMIT) : next }
      }),

    resetJob: () =>
      set({
        progress: 0,
        currentFile: '',
        fileProgressText: '',
        etaText: '',
        summaryText: '',
        logs: [],
        status: 'พร้อมทำงาน',
        error: null,
      }),

    applyPreset: (preset) => {
      set((s) => {
        const enc = preset.encode_option ?? DEFAULT_ENCODE_OPTION
        const crf = Number(preset.crf_value ?? DEFAULT_CRF)
        const res = preset.resolution ?? DEFAULT_RESOLUTION
        return {
          imagePath: preset.image_path ?? '',
          audioFolder: preset.audio_folder ?? '',
          outputFolder: preset.output_folder ?? '',
          coverFolder: preset.cover_folder ?? '',
          useMultipleCovers: Boolean(preset.use_multiple_covers),
          titlePrefix: preset.title_prefix ?? '',
          encodeOption: enc,
          /** load preset = ถือว่า user เลือกแล้ว ไม่ให้ auto-detect แก้ทับ */
          encoderUserSet: true,
          crfValue: crf,
          resolution: res,
          /** keep audio file selection — sync function จะรีเฟรชอีกที */
          appliedProjectId: s.appliedProjectId,
        }
      })
      persistCurrent()
    },

    resetForActiveProject: (projectId, paths) => {
      const cur = get()
      if (cur.appliedProjectId === projectId && projectId !== null) return
      set({
        appliedProjectId: projectId,
        projectRootRel: '',
        projectFolders: [],
        audioFolder: paths?.audioRaw ?? '',
        audioProcessedFolder: paths?.audioProcessed ?? '',
        outputFolder: paths?.renderOutput ?? '',
        coverFolder: paths?.covers ?? '',
        audioFiles: [],
        selectedAudioFiles: new Set(),
        audioSearch: '',
        progress: 0,
        currentFile: '',
        fileProgressText: '',
        etaText: '',
        summaryText: '',
        logs: [],
        status: 'พร้อมทำงาน',
        error: null,
        busy: false,
      })
    },

    selectAll: () => {
      set((s) => ({ selectedAudioFiles: new Set(s.audioFiles) }))
    },

    clearSelection: () => set({ selectedAudioFiles: new Set() }),

    toggleAudioFile: (file) =>
      set((s) => {
        const next = new Set(s.selectedAudioFiles)
        if (next.has(file)) next.delete(file)
        else next.add(file)
        return { selectedAudioFiles: next }
      }),
  }
})

/** helper: คืน BatchPreset จาก state ปัจจุบัน — ใช้ตอน save preset */
export function buildBatchPresetFromState(s: RenderStoreState): BatchPreset {
  return {
    image_path: s.imagePath,
    audio_folder: s.audioFolder,
    output_folder: s.outputFolder,
    cover_folder: s.coverFolder,
    use_multiple_covers: s.useMultipleCovers,
    title_prefix: s.titlePrefix,
    encode_option: s.encodeOption,
    crf_value: s.crfValue,
    resolution: s.resolution,
  }
}
