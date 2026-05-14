/**
 * useHubWorkspace — INKSTUDIO shim ของ INKIDEA's workspace store
 *
 * INKSTUDIO ไม่มีคอนเซ็ปต์ workspace/project — โมดูล cover/render เป็น standalone
 * ทำงานกับ absolute paths จาก file picker ของ Electron ตรง ๆ
 *
 * Shim นี้ทำให้โค้ดที่ port มาจาก INKIDEA (CoverEditor, RenderTab, useCoverEditor, ...)
 * ทำงานต่อได้โดยแมปการเรียก workspace API → window.inkstudio.fs/shell
 */

import { create } from 'zustand'

type Mode = 'cover' | 'render' | string

type ReadDataUrlResult = {
  dataUrl: string | null
  missing: boolean
}

/**
 * Shape ของ activeProject ใน INKIDEA — INKSTUDIO ไม่มี project เลยใส่ optional
 * เพื่อให้ TS ไม่บ่นเวลา code optional-chain เข้าไป (`activeProject?.paths.media.covers`)
 */
type ProjectStub = {
  id?: string
  slug?: string
  workspaceRelRoot?: string
  resolved?: {
    id: string
    audioRaw?: string
    audioProcessed?: string
    renderOutput?: string
    covers?: string
  }
  paths?: {
    media?: {
      covers?: string
    }
  }
}

type HubWorkspaceState = {
  activeProjectId: string | null
  activeProject: ProjectStub | null
  workspaceRoot: string | null
  workspaceOpenFilePath: string | null
  hubWorkspaceActiveMode: Mode

  hydrate: () => Promise<void>
  getActiveProjectRelRoot: () => string | null

  requestWorkspaceFileOpen: (rel: string | null) => void
  requestExplorerReveal: (path: string) => void
  readWorkspaceFileAsDataUrl: (path: string) => Promise<ReadDataUrlResult>
  /**
   * เปิดโฟลเดอร์: ถ้าใส่ path มา → reveal โฟลเดอร์นั้นใน Explorer
   * ถ้าไม่ใส่ → เปิด picker ให้เลือกโฟลเดอร์ใหม่ (คืน path หรือ null)
   */
  openFolder: (path?: string) => Promise<string | null>

  setEditorTabCloseForMode: (mode: Mode, fn: undefined | (() => boolean)) => void
  setEditorTabCycleForMode: (mode: Mode, fn: undefined | ((dir: 1 | -1) => boolean)) => void
}

const BYTES_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
}

function mimeFromPath(p: string): string {
  const m = p.match(/\.([a-zA-Z0-9]+)$/u)
  const ext = (m?.[1] ?? '').toLowerCase()
  return BYTES_TO_MIME[ext] ?? 'application/octet-stream'
}

export const useHubWorkspace = create<HubWorkspaceState>(() => ({
  activeProjectId: 'inkstudio',
  activeProject: null,
  workspaceRoot: null,
  workspaceOpenFilePath: null,
  hubWorkspaceActiveMode: 'cover',

  hydrate: async () => { /* no workspace concept in INKSTUDIO */ },
  getActiveProjectRelRoot: () => null,

  requestWorkspaceFileOpen: () => { /* no-op — tabs disabled */ },

  requestExplorerReveal: (p) => {
    void window.inkstudio?.shell.showItemInFolder(p)
  },

  readWorkspaceFileAsDataUrl: async (p) => {
    const fs = window.inkstudio?.fs
    if (!fs) return { dataUrl: null, missing: true }
    try {
      const res = await fs.readBytes(p)
      if (!res?.ok || !res.base64) return { dataUrl: null, missing: true }
      return { dataUrl: `data:${mimeFromPath(p)};base64,${res.base64}`, missing: false }
    } catch {
      return { dataUrl: null, missing: true }
    }
  },

  openFolder: async (path?: string) => {
    if (path) {
      void window.inkstudio?.fs.revealFolder(path)
      return path
    }
    const folder = await window.inkstudio?.fs.chooseFolder()
    return folder ?? null
  },

  setEditorTabCloseForMode: () => { /* no-op */ },
  setEditorTabCycleForMode: () => { /* no-op */ },
}))
