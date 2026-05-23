/**
 * window.inkstudio — preload-exposed namespace
 *
 * ตรงตาม electron/preload.cjs — เมื่อ port โมดูล cover/render จาก INKIDEA ให้เพิ่ม
 * namespace `render` + `cover` ใน preload + แก้ type นี้ตามจริง
 */

export type SelectFilesOptions = {
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
  filters?: Array<{ name: string; extensions: string[] }>
}

export type RenderProgressPayload = {
  jobId: string
  phase: string
  progress: number
  message?: string
  fileName?: string
  fileProgressPercent?: number
  overallPercent?: number
  currentTimeText?: string
  durationText?: string
  etaText?: string
  summary?: RenderSummary
}

export type RenderSummary = {
  successCount: number
  totalFiles: number
  elapsedSeconds: number
  skippedCount: number
  missingCovers: string[]
  encoder: string
  resolutionLabel: string
}

export type RenderBatchArgs = {
  jobId: string
  imagePath: string
  audioFolder: string
  doneFolder?: string
  outputFolder: string
  coverFolder: string
  useMultipleCovers: boolean
  titlePrefix: string
  /** ไฟล์อินโทร (วิดีโอ) ที่จะ prepend หน้าทุกตอน — ว่าง = ไม่ใช้ (INKIDEA shape) */
  introPath?: string
  /** legacy field — เก็บไว้รองรับโค้ดเก่า, ใช้ introPath เป็นหลัก */
  introClipPath?: string
  encodeOption: string
  crfValue: number
  /** '144p' | '240p' | '360p' | '480p' | '720p' | '1080p' */
  resolutionLabel: string
  /** FPS ของ video stream — optional (default 1 fps) */
  fps?: number
  /** x264 preset — optional (default 'ultrafast') */
  preset?: string
  overwriteMode: 'ask' | 'skip' | 'overwrite' | 'replace_all' | 'skip_all'
  selectedAudioFiles: string[]
}

export type ProbeResult = { ok: boolean; error: string }
export type EncoderDiag = {
  preferred?: string
  platform?: string
  gpu: { name: string; driver: string } | null
  nvenc: ProbeResult
  encoders?: {
    nvencH264: ProbeResult
    nvencHevc: ProbeResult
    vtH264: ProbeResult
    vtHevc: ProbeResult
    software: ProbeResult
  }
}

export type AudioFolderChangedPayload = {
  folderPath: string
}

export type PresetMap = Record<string, unknown>

/**
 * Auto-update event payloads — emitted by electron/autoUpdate.cjs
 *
 * `mode`:
 *   - 'portable' — custom updater (Win portable / mac ad-hoc) — banner shows
 *     a manual "อัพเดตเลย" button that triggers download + helper swap
 *   - 'auto'     — electron-updater NSIS path — banner shows "รีสตาร์ทเดี๋ยวนี้"
 *     after quiet background download
 */
export type UpdateAvailableInfo = {
  mode: 'portable' | 'auto'
  version: string
  current?: string
  downloadUrl?: string
  releaseUrl?: string
  releaseDate?: string | null
  releaseNotes?: string
}

export type UpdateProgressInfo = {
  percent: number
  received?: number
  total?: number
  bytesPerSecond?: number
}

export type UpdateDownloadedInfo = {
  mode: 'portable' | 'auto'
  version: string
}

export type UpdateErrorInfo = {
  message: string
}

export type UpdateCheckResult = {
  available: boolean
  version?: string
  latest?: string
  current?: string
  releaseDate?: string | null
  releaseUrl?: string
  downloadUrl?: string
}

/**
 * INKIDEA-style legacy IPC surface — exposed via electronIpcShim
 * Code ที่ port มาจาก INKIDEA จะเรียก window.electron.ipc.* ตามนี้
 */
export type LegacyElectronIpc = {
  selectFiles: (opts: SelectFilesOptions & { defaultPath?: string }) => Promise<string[]>
  readFileAsDataUrl: (arg: { filePath: string }) => Promise<string>
  savePath: (arg: { defaultPath?: string; filters?: SelectFilesOptions['filters']; title?: string }) => Promise<string | null>
  exportCoverPng: (arg: { filePath?: string; outputPath?: string; base64?: string; dataUrl?: string }) => Promise<{ ok: boolean; error?: string }>
  listFonts: () => Promise<string[]>
  hubReadWorkspaceTextFile: (arg: { relPath: string }) => Promise<{ missing: boolean; content?: string }>
  hubWriteWorkspaceTextFile: (arg: { relPath: string; content: string }) => Promise<void>
  hubOpenInExplorerWorkspaceRel: (arg: { relPath: string }) => Promise<void>
  hubListProjects: () => Promise<unknown[]>
  startBatchCoverRender: (args: RenderBatchArgs) => Promise<RenderSummary>
  cancelRenderJob: (arg: { jobId: string }) => Promise<{ ok: boolean }>
  onRenderProgress: (cb: (payload: RenderProgressPayload) => void) => void
  offRenderProgress: () => void
  listAudioFiles: (arg: { folderPath: string }) => Promise<string[]>
  getPreferredEncoder: () => Promise<string>
  diagnoseEncoder: (arg?: { refresh?: boolean }) => Promise<EncoderDiag>
  watchAudioFolder: (arg: { folderPath: string }) => Promise<{ watching: boolean }>
  unwatchAudioFolder: () => Promise<{ watching: boolean }>
  onAudioFolderChanged: (cb: (payload: AudioFolderChangedPayload) => void) => void
  offAudioFolderChanged: () => void
  listPresets: () => Promise<PresetMap>
  savePreset: (arg: { name: string; data: unknown }) => Promise<PresetMap>
  deletePreset: (arg: { name: string }) => Promise<PresetMap>
}

declare global {
  interface Window {
    electron?: {
      ipc: LegacyElectronIpc
      platform?: NodeJS.Platform
    }
    inkstudio?: {
      platform: NodeJS.Platform
      isMac: boolean
      isWin: boolean
      isLinux: boolean

      app: {
        version: string
        checkUpdate: () => Promise<{ ok: boolean; result?: UpdateCheckResult | null; error?: string }>
        applyUpdate: () => Promise<{ ok: boolean; downloaded?: boolean; error?: string }>
        onUpdateAvailable: (handler: (info: UpdateAvailableInfo) => void) => () => void
        onUpdateProgress: (handler: (info: UpdateProgressInfo) => void) => () => void
        onUpdateDownloaded: (handler: (info: UpdateDownloadedInfo) => void) => () => void
        onUpdateError: (handler: (info: UpdateErrorInfo) => void) => () => void
      }

      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        toggleDevTools: () => Promise<void>
        reload: () => Promise<void>
        setTitle: (title: string) => Promise<void>
      }

      fs: {
        chooseFolder: (opts?: SelectFilesOptions) => Promise<string | null>
        chooseFiles: (opts?: SelectFilesOptions) => Promise<string[]>
        chooseFile: (opts?: SelectFilesOptions) => Promise<string | null>
        readText: (path: string) => Promise<{ ok: boolean; content?: string; error?: string }>
        writeText: (
          path: string,
          content: string,
        ) => Promise<{ ok: boolean; error?: string }>
        readBytes: (path: string) => Promise<{ ok: boolean; base64?: string; error?: string }>
        writeBytes: (
          path: string,
          base64: string,
        ) => Promise<{ ok: boolean; error?: string }>
        listDir: (dir: string, opts?: unknown) => Promise<unknown[]>
        mkdir: (dir: string) => Promise<void>
        stat: (path: string) => Promise<unknown>
        exists: (path: string) => Promise<boolean>
        revealFolder: (path: string) => Promise<void>
      }

      dialog: {
        message: (opts: unknown) => Promise<unknown>
        confirm: (opts: unknown) => Promise<boolean>
        saveFile: (opts: unknown) => Promise<string | null>
      }

      settings: {
        get: () => Promise<Record<string, unknown>>
        patch: (partial: Record<string, unknown>) => Promise<void>
        setKey: (key: string, value: unknown) => Promise<void>
        reset: () => Promise<void>
        onChange: (handler: (payload: unknown) => void) => () => void
      }

      log: {
        info: (scope: string, msg: string, data?: unknown) => Promise<void>
        warn: (scope: string, msg: string, data?: unknown) => Promise<void>
        error: (scope: string, msg: string, data?: unknown) => Promise<void>
        debug: (scope: string, msg: string, data?: unknown) => Promise<void>
        getLogPath: () => Promise<string>
      }

      shell: {
        showItemInFolder: (path: string) => Promise<void>
        beep: () => Promise<void>
      }

      render: {
        checkFfmpeg: () => Promise<{ ok: boolean; version?: string; path?: string; error?: string }>
        listAudioFiles: (folderPath: string) => Promise<string[]>
        getPreferredEncoder: () => Promise<string>
        diagnoseEncoder?: (refresh?: boolean) => Promise<EncoderDiag>
        watchAudioFolder?: (folderPath: string) => Promise<{ watching: boolean }>
        unwatchAudioFolder?: () => Promise<{ watching: boolean }>
        onAudioFolderChanged?: (handler: (payload: AudioFolderChangedPayload) => void) => () => void
        startBatch: (args: {
          jobId: string
          coverPath?: string
          coverFolder?: string
          useMultipleCovers: boolean
          audioFolder: string
          selectedAudioFiles: string[]
          outputFolder: string
          titlePrefix: string
          /** ไฟล์อินโทรที่จะ prepend หน้าทุกตอน — INKIDEA shape */
          introPath?: string
          /** legacy alias */
          introClipPath?: string
          doneFolder?: string
          encodeOption: string
          crfValue: number
          resolutionLabel: '144p' | '240p' | '360p' | '480p' | '720p' | '1080p'
          fps?: number
          preset?: string
          overwriteMode: 'skip' | 'overwrite' | 'ask' | 'replace_all' | 'skip_all'
        }) => Promise<RenderSummary>
        cancelJob: (jobId: string) => Promise<{ ok: boolean }>
        onProgress: (handler: (payload: RenderProgressPayload) => void) => () => void
      }
    }
  }
}

export {}
