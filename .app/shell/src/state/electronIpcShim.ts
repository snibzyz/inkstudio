/**
 * electronIpcShim — ทำให้ code ที่ port มาจาก INKIDEA (เรียก `window.electron.ipc.*`)
 * ทำงานได้บน INKSTUDIO (preload เปิด `window.inkstudio.*`)
 *
 * Map signature ระหว่าง 2 namespace + จำลอง method ที่ INKSTUDIO ยังไม่มี IPC
 * (เช่น preset → localStorage) ให้ UI render ได้โดยไม่ต้องแก้ call site
 *
 * Import จาก main.tsx ครั้งเดียว — มันจะติดตั้ง `window.electron = { ipc: ... }`
 */

import type {
  AudioFolderChangedPayload,
  EncoderDiag,
  LegacyElectronIpc,
  PresetMap,
  RenderBatchArgs,
  RenderProgressPayload,
  RenderSummary,
  SelectFilesOptions,
} from '@/types/window'

const PRESETS_STORAGE_KEY = 'inkstudio:render:presets:v1'

const BYTES_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  json: 'application/json',
  txt: 'text/plain',
}

function mimeFromPath(p: string): string {
  const m = p.match(/\.([a-zA-Z0-9]+)$/u)
  const ext = (m?.[1] ?? '').toLowerCase()
  return BYTES_TO_MIME[ext] ?? 'application/octet-stream'
}

function loadPresets(): PresetMap {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PresetMap) : {}
  } catch {
    return {}
  }
}

function savePresets(map: PresetMap) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

type ProgressCallback = (payload: RenderProgressPayload) => void
let progressUnsubscribe: (() => void) | null = null
let audioFolderUnsubscribe: (() => void) | null = null

export function installElectronIpcShim() {
  if (typeof window === 'undefined') return
  const inkstudio = window.inkstudio
  if (!inkstudio) {
    window.electron = {
      ipc: new Proxy({} as LegacyElectronIpc, {
        get: () => () => Promise.reject(new Error('IPC ไม่พร้อม')),
      }) as LegacyElectronIpc,
    }
    return
  }

  const ipc: LegacyElectronIpc = {
    // ---------- file picking ----------
    async selectFiles(opts: SelectFilesOptions = {}): Promise<string[]> {
      const properties = opts.properties ?? ['openFile']
      if (properties.includes('openDirectory')) {
        const folder = await inkstudio.fs.chooseFolder(opts)
        return folder ? [folder] : []
      }
      if (properties.includes('multiSelections')) {
        return await inkstudio.fs.chooseFiles(opts)
      }
      const single = await inkstudio.fs.chooseFile(opts)
      return single ? [single] : []
    },

    async readFileAsDataUrl(arg: { filePath: string }): Promise<string> {
      const res = await inkstudio.fs.readBytes(arg.filePath)
      if (!res?.ok || !res.base64) throw new Error(res?.error ?? 'อ่านไฟล์ไม่สำเร็จ')
      return `data:${mimeFromPath(arg.filePath)};base64,${res.base64}`
    },

    async savePath(arg: { defaultPath?: string; filters?: SelectFilesOptions['filters']; title?: string }): Promise<string | null> {
      return inkstudio.dialog.saveFile({
        defaultPath: arg.defaultPath,
        filters: arg.filters,
        title: arg.title,
      })
    },

    // ---------- cover export ----------
    async exportCoverPng(arg: { filePath?: string; outputPath?: string; base64?: string; dataUrl?: string }): Promise<{ ok: boolean; error?: string }> {
      const target = arg.outputPath ?? arg.filePath
      if (!target) return { ok: false, error: 'ไม่มี outputPath' }
      let base64 = arg.base64
      if (!base64 && arg.dataUrl) {
        const idx = arg.dataUrl.indexOf(',')
        base64 = idx >= 0 ? arg.dataUrl.slice(idx + 1) : arg.dataUrl
      }
      if (!base64) return { ok: false, error: 'ไม่มีข้อมูลภาพ' }
      return inkstudio.fs.writeBytes(target, base64)
    },

    // ---------- fonts ----------
    async listFonts(): Promise<string[]> {
      try {
        const nav = navigator as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }
        if (typeof nav.queryLocalFonts === 'function') {
          const fonts = await nav.queryLocalFonts()
          const families = new Set<string>()
          for (const f of fonts) families.add(f.family)
          return Array.from(families).sort()
        }
      } catch { /* fall through */ }
      return []
    },

    // ---------- workspace-rel I/O (INKSTUDIO ไม่มี workspace concept) ----------
    async hubReadWorkspaceTextFile(_arg: { relPath: string }): Promise<{ missing: boolean; content?: string }> {
      return { missing: true }
    },
    async hubWriteWorkspaceTextFile(_arg: { relPath: string; content: string }): Promise<void> {
      throw new Error('บันทึกใน workspace ไม่รองรับ — ใช้ "บันทึกเทมเพลต" + เลือกไฟล์ JSON แทน')
    },
    async hubOpenInExplorerWorkspaceRel(_arg: { relPath: string }): Promise<void> {
      throw new Error('เปิดโฟลเดอร์ใน workspace ไม่รองรับใน INKSTUDIO')
    },
    async hubListProjects(): Promise<unknown[]> { return [] },

    // ---------- render IPC — wrap window.inkstudio.render.* ----------
    async startBatchCoverRender(args: RenderBatchArgs): Promise<RenderSummary> {
      const r = inkstudio.render
      if (!r) throw new Error('โมดูล render ยังไม่ wire')
      /** ใช้ introPath ถ้ามี (INKIDEA shape) — fallback ไปที่ introClipPath (legacy) */
      const intro = args.introPath || args.introClipPath
      return r.startBatch({
        jobId: args.jobId,
        coverPath: args.useMultipleCovers ? undefined : args.imagePath,
        coverFolder: args.useMultipleCovers ? args.coverFolder : undefined,
        useMultipleCovers: args.useMultipleCovers,
        audioFolder: args.audioFolder,
        selectedAudioFiles: args.selectedAudioFiles,
        outputFolder: args.outputFolder,
        titlePrefix: args.titlePrefix,
        introPath: intro,
        introClipPath: intro,
        doneFolder: args.doneFolder,
        encodeOption: args.encodeOption,
        crfValue: args.crfValue,
        resolutionLabel: args.resolutionLabel as '144p' | '240p' | '360p' | '480p' | '720p' | '1080p',
        fps: args.fps,
        preset: args.preset,
        overwriteMode: args.overwriteMode === 'ask' ? 'skip' : args.overwriteMode,
      })
    },

    async cancelRenderJob(arg: { jobId: string }): Promise<{ ok: boolean }> {
      const r = inkstudio.render
      if (!r) return { ok: false }
      return r.cancelJob(arg.jobId)
    },

    onRenderProgress(cb: ProgressCallback): void {
      const r = inkstudio.render
      if (!r) return
      if (progressUnsubscribe) progressUnsubscribe()
      progressUnsubscribe = r.onProgress(cb)
    },

    offRenderProgress(): void {
      if (progressUnsubscribe) {
        progressUnsubscribe()
        progressUnsubscribe = null
      }
    },

    async listAudioFiles(arg: { folderPath: string }): Promise<string[]> {
      const r = inkstudio.render
      if (!r) return []
      return r.listAudioFiles(arg.folderPath)
    },

    async getPreferredEncoder(): Promise<string> {
      const r = inkstudio.render
      if (!r) return ''
      try { return await r.getPreferredEncoder() } catch { return '' }
    },

    async diagnoseEncoder(arg?: { refresh?: boolean }): Promise<EncoderDiag> {
      const r = inkstudio.render
      const softwareOk = { ok: true, error: '' }
      const fallback: EncoderDiag = {
        preferred: 'Software (H.264)',
        platform: typeof window !== 'undefined' ? (window.electron?.platform ?? inkstudio.platform) : undefined,
        gpu: null,
        nvenc: { ok: false, error: '' },
        encoders: {
          nvencH264: { ok: false, error: 'ไม่รองรับ' },
          nvencHevc: { ok: false, error: 'ไม่รองรับ' },
          vtH264: { ok: false, error: 'ไม่รองรับ' },
          vtHevc: { ok: false, error: 'ไม่รองรับ' },
          software: softwareOk,
        },
      }
      if (!r?.diagnoseEncoder) return fallback
      try {
        return await r.diagnoseEncoder(arg?.refresh)
      } catch {
        return fallback
      }
    },

    async watchAudioFolder(arg: { folderPath: string }): Promise<{ watching: boolean }> {
      const r = inkstudio.render
      if (!r?.watchAudioFolder) return { watching: false }
      try { return await r.watchAudioFolder(arg.folderPath) } catch { return { watching: false } }
    },

    async unwatchAudioFolder(): Promise<{ watching: boolean }> {
      const r = inkstudio.render
      if (!r?.unwatchAudioFolder) return { watching: false }
      try { return await r.unwatchAudioFolder() } catch { return { watching: false } }
    },

    onAudioFolderChanged(cb: (payload: AudioFolderChangedPayload) => void): void {
      const r = inkstudio.render
      if (!r?.onAudioFolderChanged) return
      if (audioFolderUnsubscribe) audioFolderUnsubscribe()
      audioFolderUnsubscribe = r.onAudioFolderChanged(cb)
    },

    offAudioFolderChanged(): void {
      if (audioFolderUnsubscribe) {
        audioFolderUnsubscribe()
        audioFolderUnsubscribe = null
      }
    },

    // ---------- presets (localStorage) ----------
    async listPresets(): Promise<PresetMap> {
      return loadPresets()
    },
    async savePreset(arg: { name: string; data: unknown }): Promise<PresetMap> {
      const map = loadPresets()
      map[arg.name] = arg.data
      savePresets(map)
      return map
    },
    async deletePreset(arg: { name: string }): Promise<PresetMap> {
      const map = loadPresets()
      delete map[arg.name]
      savePresets(map)
      return map
    },
  }

  window.electron = { ipc, platform: inkstudio.platform }
}
