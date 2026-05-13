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
  encodeOption: string
  crfValue: number
  resolutionLabel: string
  overwriteMode: 'ask' | 'skip' | 'overwrite'
  selectedAudioFiles: string[]
}

declare global {
  interface Window {
    inkstudio?: {
      platform: NodeJS.Platform
      isMac: boolean
      isWin: boolean
      isLinux: boolean

      app: {
        version: string
        checkUpdate: () => Promise<unknown>
        applyUpdate: () => Promise<unknown>
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
        startBatch: (args: {
          jobId: string
          coverPath?: string
          coverFolder?: string
          useMultipleCovers: boolean
          audioFolder: string
          selectedAudioFiles: string[]
          outputFolder: string
          titlePrefix: string
          encodeOption: string
          crfValue: number
          resolutionLabel: '480p' | '720p' | '1080p'
          overwriteMode: 'skip' | 'overwrite'
        }) => Promise<RenderSummary>
        cancelJob: (jobId: string) => Promise<{ ok: boolean }>
        onProgress: (handler: (payload: RenderProgressPayload) => void) => () => void
      }
    }
  }
}

export {}
