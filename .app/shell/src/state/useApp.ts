import { create } from 'zustand'

export type ModuleId = 'cover' | 'render'

export const MODULE_ORDER: ModuleId[] = ['cover', 'render']

export const MODULE_META: Record<ModuleId, { label: string; icon: string; description: string }> = {
  cover: {
    label: 'ปก',
    icon: 'symbol-color',
    description: 'ทำปกตอนนิยายแบบ batch — เปลี่ยนเลขตอนอัตโนมัติ + บันทึก/โหลด script',
  },
  render: {
    label: 'คลิป',
    icon: 'device-camera-video',
    description: 'เรนเดอร์วิดีโอจากปก + ไฟล์เสียงเป็นชุด ผ่าน FFmpeg',
  },
}

type AppState = {
  activeModule: ModuleId
  setActiveModule: (id: ModuleId) => void
}

const STORAGE_KEY = 'inkstudio:app:v1'

function loadInitial(): ModuleId {
  try {
    if (typeof localStorage === 'undefined') return 'cover'
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'cover'
    const parsed = JSON.parse(raw)
    return parsed?.activeModule === 'render' ? 'render' : 'cover'
  } catch {
    return 'cover'
  }
}

function persist(activeModule: ModuleId) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeModule }))
  } catch {
    /* ignore */
  }
}

export const useApp = create<AppState>((set) => ({
  activeModule: loadInitial(),
  setActiveModule: (id) => {
    set({ activeModule: id })
    persist(id)
  },
}))
