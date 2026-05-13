/**
 * useCoverState — zustand store ของโมดูล cover
 *
 * Flow: user upload ภาพปก 1 ภาพ → เราใช้เป็น
 *   1. พื้นหลัง (blur + ดิม)
 *   2. ปก foreground ตรงกลาง (ไม่ blur)
 * แล้ววาดข้อความ 2 layers: title (ชื่อเรื่อง) + chapter (เลขตอน — auto)
 *
 * Canvas เป้าหมาย 1280×720 (16:9) ตรงกับ frame ของ video render
 */

import { create } from 'zustand'

const STORAGE_KEY = 'inkstudio:cover:v2'
const SCRIPTS_KEY = 'inkstudio:cover-scripts:v2'

export type CoverFormat = 'png' | 'jpg'

export type TextLayer = {
  /** template — รองรับ token {n} (จะถูก replace ด้วยเลขตอนตอน render) */
  text: string
  fontSize: number
  color: string
  /** percent ของ canvas (0–100) */
  xPercent: number
  yPercent: number
  align: 'left' | 'center' | 'right'
  /** ขอบดำเพื่อให้อ่านง่ายบนพื้นสว่าง */
  stroke: boolean
  /** font weight 100..900 */
  weight: number
}

export type BackgroundConfig = {
  /** ค่า blur (px) ของพื้นหลัง 0–40 */
  blur: number
  /** ค่า darken overlay 0–1 (0 = ไม่ดิม, 1 = ดำสนิท) */
  dim: number
}

export type ForegroundConfig = {
  /** แสดงปก foreground ตรงกลาง */
  show: boolean
  /** ขนาด — fraction ของ canvas height (0.2–1.0) */
  scale: number
  /** ตำแหน่งกึ่งกลาง (% ของ canvas) */
  xPercent: number
  yPercent: number
  /** มุมโค้ง (px) */
  cornerRadius: number
  /** เงา */
  shadow: boolean
}

export type BatchConfig = {
  start: number
  end: number
  step: number
  padding: number
  outputFolder: string
  format: CoverFormat
  quality: number
}

export type CoverScript = {
  background: BackgroundConfig
  foreground: ForegroundConfig
  title: TextLayer
  chapter: TextLayer
  batch: Omit<BatchConfig, 'outputFolder'>
  hint?: string
}

type CoverJob = {
  busy: boolean
  progress: number
  current: number
  total: number
  message: string
  error: string | null
}

export type CoverPersisted = {
  background: BackgroundConfig
  foreground: ForegroundConfig
  title: TextLayer
  chapter: TextLayer
  batch: BatchConfig
  previewChapter: number
}

type CoverState = {
  baseImage: { dataUrl: string; name: string } | null
  background: BackgroundConfig
  foreground: ForegroundConfig
  title: TextLayer
  chapter: TextLayer
  batch: BatchConfig
  previewChapter: number
  scripts: Record<string, CoverScript>
  selectedScript: string
  job: CoverJob

  setBaseImage: (img: { dataUrl: string; name: string } | null) => void
  patchBackground: (patch: Partial<BackgroundConfig>) => void
  patchForeground: (patch: Partial<ForegroundConfig>) => void
  patchTitle: (patch: Partial<TextLayer>) => void
  patchChapter: (patch: Partial<TextLayer>) => void
  patchBatch: (patch: Partial<BatchConfig>) => void
  setPreviewChapter: (n: number) => void

  saveScript: (name: string) => void
  loadScript: (name: string) => void
  deleteScript: (name: string) => void
  setSelectedScript: (name: string) => void

  setJob: (patch: Partial<CoverJob>) => void
  resetJob: () => void
}

const DEFAULT_BG: BackgroundConfig = { blur: 16, dim: 0.45 }

const DEFAULT_FG: ForegroundConfig = {
  show: true,
  scale: 0.78,
  xPercent: 28,
  yPercent: 50,
  cornerRadius: 8,
  shadow: true,
}

const DEFAULT_TITLE: TextLayer = {
  text: 'ชื่อเรื่อง',
  fontSize: 48,
  color: '#ffffff',
  xPercent: 60,
  yPercent: 38,
  align: 'left',
  stroke: true,
  weight: 700,
}

const DEFAULT_CHAPTER: TextLayer = {
  text: 'ตอนที่ {n}',
  fontSize: 64,
  color: '#F59E0B',
  xPercent: 60,
  yPercent: 60,
  align: 'left',
  stroke: true,
  weight: 800,
}

const DEFAULT_BATCH: BatchConfig = {
  start: 1,
  end: 10,
  step: 1,
  padding: 3,
  outputFolder: '',
  format: 'png',
  quality: 92,
}

function loadPersisted(): Partial<CoverPersisted> {
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

function persistOptions(state: CoverPersisted) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function loadScripts(): Record<string, CoverScript> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(SCRIPTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistScripts(scripts: Record<string, CoverScript>) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts))
  } catch {
    /* ignore */
  }
}

const persisted = loadPersisted()

export const useCoverState = create<CoverState>((set, get) => {
  const snapshot = () => {
    const s = get()
    persistOptions({
      background: s.background,
      foreground: s.foreground,
      title: s.title,
      chapter: s.chapter,
      batch: s.batch,
      previewChapter: s.previewChapter,
    })
  }

  return {
    baseImage: null,
    background: { ...DEFAULT_BG, ...(persisted.background ?? {}) },
    foreground: { ...DEFAULT_FG, ...(persisted.foreground ?? {}) },
    title: { ...DEFAULT_TITLE, ...(persisted.title ?? {}) },
    chapter: { ...DEFAULT_CHAPTER, ...(persisted.chapter ?? {}) },
    batch: { ...DEFAULT_BATCH, ...(persisted.batch ?? {}) },
    previewChapter: persisted.previewChapter ?? 1,
    scripts: loadScripts(),
    selectedScript: '',
    job: { busy: false, progress: 0, current: 0, total: 0, message: '', error: null },

    setBaseImage: (img) => set({ baseImage: img }),

    patchBackground: (patch) => {
      set((s) => ({ background: { ...s.background, ...patch } }))
      snapshot()
    },
    patchForeground: (patch) => {
      set((s) => ({ foreground: { ...s.foreground, ...patch } }))
      snapshot()
    },
    patchTitle: (patch) => {
      set((s) => ({ title: { ...s.title, ...patch } }))
      snapshot()
    },
    patchChapter: (patch) => {
      set((s) => ({ chapter: { ...s.chapter, ...patch } }))
      snapshot()
    },
    patchBatch: (patch) => {
      set((s) => ({ batch: { ...s.batch, ...patch } }))
      snapshot()
    },
    setPreviewChapter: (n) => {
      set({ previewChapter: Math.max(0, Math.floor(n)) })
      snapshot()
    },

    saveScript: (name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const s = get()
      const next = {
        ...s.scripts,
        [trimmed]: {
          background: s.background,
          foreground: s.foreground,
          title: s.title,
          chapter: s.chapter,
          batch: {
            start: s.batch.start,
            end: s.batch.end,
            step: s.batch.step,
            padding: s.batch.padding,
            format: s.batch.format,
            quality: s.batch.quality,
          },
          hint: s.baseImage?.name,
        },
      }
      persistScripts(next)
      set({ scripts: next, selectedScript: trimmed })
    },
    loadScript: (name) => {
      const s = get()
      const script = s.scripts[name]
      if (!script) return
      set((cur) => ({
        background: { ...DEFAULT_BG, ...script.background },
        foreground: { ...DEFAULT_FG, ...script.foreground },
        title: { ...DEFAULT_TITLE, ...script.title },
        chapter: { ...DEFAULT_CHAPTER, ...script.chapter },
        batch: { ...cur.batch, ...script.batch },
        selectedScript: name,
      }))
      snapshot()
    },
    deleteScript: (name) => {
      const s = get()
      if (!s.scripts[name]) return
      const next = { ...s.scripts }
      delete next[name]
      persistScripts(next)
      set({
        scripts: next,
        selectedScript: s.selectedScript === name ? '' : s.selectedScript,
      })
    },
    setSelectedScript: (name) => set({ selectedScript: name }),

    setJob: (patch) => set((s) => ({ job: { ...s.job, ...patch } })),
    resetJob: () =>
      set({ job: { busy: false, progress: 0, current: 0, total: 0, message: '', error: null } }),
  }
})

export { DEFAULT_BG, DEFAULT_FG, DEFAULT_TITLE, DEFAULT_CHAPTER, DEFAULT_BATCH }
