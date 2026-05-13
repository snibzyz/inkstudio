/**
 * useStudio — shared state ที่ใช้ข้ามโมดูล (cover ↔ render)
 *
 * เก็บผลลัพธ์ล่าสุดของโมดูล cover เพื่อให้ render นำมาใช้เป็น default input
 * โดยไม่ต้องให้ user เลือกซ้ำ
 */

import { create } from 'zustand'

const STORAGE_KEY = 'inkstudio:studio:v1'

type CoverOutputKind = 'single' | 'folder'

export type CoverOutput = {
  kind: CoverOutputKind
  /** path ของไฟล์ภาพล่าสุด (kind === 'single') */
  filePath?: string
  /** path ของโฟลเดอร์ที่ส่งออก batch ล่าสุด (kind === 'folder') */
  folderPath?: string
  /** เวลาที่ตั้งค่าล่าสุด — ใช้ตัดสินใจว่าควร suggest ให้ใช้หรือไม่ */
  updatedAt: number
}

type StudioState = {
  coverOutput: CoverOutput | null
  setCoverOutput: (out: CoverOutput) => void
  clearCoverOutput: () => void
}

function loadInitial(): CoverOutput | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.coverOutput) return null
    return parsed.coverOutput as CoverOutput
  } catch {
    return null
  }
}

function persist(coverOutput: CoverOutput | null) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ coverOutput }))
  } catch {
    /* ignore */
  }
}

export const useStudio = create<StudioState>((set) => ({
  coverOutput: loadInitial(),
  setCoverOutput: (out) => {
    set({ coverOutput: out })
    persist(out)
  },
  clearCoverOutput: () => {
    set({ coverOutput: null })
    persist(null)
  },
}))
