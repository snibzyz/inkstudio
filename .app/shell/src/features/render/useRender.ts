/**
 * useRender — Zustand store ของแท็บ Render (เครื่องมือคลิป)
 *
 * INKSTUDIO ตัด encoding/preset ออก — profile fix ที่ 360p · 1 fps · CRF 30 · Software H.264
 *
 * รับผิดชอบ:
 *   - state ของ Source (image / audio / output / cover / multi-cover / titlePrefix / introClipPath)
 *   - state ของ Files (audio file list + search + selection)
 *   - state ของ Job (busy/error/status/progress/currentFile/eta/summary/logs)
 *   - persist เฉพาะ introClipPath (จำ intro ล่าสุด)
 *
 * Logic ที่ involve IPC (scan audio folder / start/cancel render)
 *   อยู่ใน useRenderJob — store นี้เก็บ state slices ล้วน ๆ
 */

import { create } from 'zustand'
import {
  FIXED_CRF,
  FIXED_ENCODE_OPTION,
  FIXED_RESOLUTION,
  LOG_BUFFER_LIMIT,
  STORAGE_KEY,
} from './renderConstants'
import type { PersistedRenderOptions } from './renderTypes'

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
  /** intro clip ที่จะแทรกหน้าวิดีโอแต่ละตอน — ว่าง = ไม่ใช้ */
  introClipPath: string

  /** Encoding — ค่า fix สำหรับ runtime backwards-compat (UI ไม่ให้แก้) */
  readonly encodeOption: typeof FIXED_ENCODE_OPTION
  readonly crfValue: typeof FIXED_CRF
  readonly resolution: typeof FIXED_RESOLUTION

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

  /** Setters — Source */
  setImagePath: (v: string) => void
  setAudioFolder: (v: string) => void
  setOutputFolder: (v: string) => void
  setCoverFolder: (v: string) => void
  setUseMultipleCovers: (v: boolean) => void
  setTitlePrefix: (v: string) => void
  setIntroClipPath: (v: string) => void

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
  const persistCurrent = () => {
    schedulePersist({ introClipPath: get().introClipPath })
  }

  return {
    imagePath: '',
    audioFolder: '',
    audioProcessedFolder: '',
    outputFolder: '',
    coverFolder: '',
    useMultipleCovers: false,
    titlePrefix: '',
    introClipPath: typeof persisted.introClipPath === 'string' ? persisted.introClipPath : '',

    encodeOption: FIXED_ENCODE_OPTION,
    crfValue: FIXED_CRF,
    resolution: FIXED_RESOLUTION,

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

    setImagePath: (v) => set({ imagePath: v }),
    setAudioFolder: (v) => set({ audioFolder: v }),
    setOutputFolder: (v) => set({ outputFolder: v }),
    setCoverFolder: (v) => set({ coverFolder: v }),
    setUseMultipleCovers: (v) => set({ useMultipleCovers: v }),
    setTitlePrefix: (v) => set({ titlePrefix: v }),
    setIntroClipPath: (v) => {
      set({ introClipPath: v })
      persistCurrent()
    },

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

    resetForActiveProject: (projectId, paths) => {
      const cur = get()
      if (cur.appliedProjectId === projectId && projectId !== null) return
      set({
        appliedProjectId: projectId,
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
