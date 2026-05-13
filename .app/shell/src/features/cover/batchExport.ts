/**
 * batchExport — generate ปกทุกตอน + เขียนลง disk
 *
 * Render ที่ขนาด 1280×720 (frame ของ video render) — เขียนผ่าน
 * window.inkstudio.fs.writeBytes (base64)
 */

import { drawCover, formatChapterNumber, dataUrlToBase64 } from './coverRender'
import type {
  BackgroundConfig,
  BatchConfig,
  ForegroundConfig,
  TextLayer,
} from './useCoverState'

const RENDER_W = 1280
const RENDER_H = 720

export type BatchProgress = {
  current: number
  total: number
  chapter: number
  fileName: string
}

export type BatchResult = {
  outputFolder: string
  totalFiles: number
  successCount: number
  failedFiles: string[]
}

export class BatchExportError extends Error {
  cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'BatchExportError'
    this.cause = cause
  }
}

export type BatchExportInput = {
  baseImageDataUrl: string | null
  background: BackgroundConfig
  foreground: ForegroundConfig
  title: TextLayer
  chapter: TextLayer
  batch: BatchConfig
}

export async function runBatchExport(
  input: BatchExportInput,
  onProgress: (p: BatchProgress) => void,
  shouldCancel: () => boolean,
): Promise<BatchResult> {
  const writeBytes = window.inkstudio?.fs?.writeBytes
  if (!writeBytes) {
    throw new BatchExportError('โปรดเปิดจากแอป Electron (window.inkstudio.fs ยังไม่พร้อม)')
  }
  if (!input.batch.outputFolder) {
    throw new BatchExportError('กรุณาเลือกโฟลเดอร์ปลายทางก่อน')
  }
  if (input.batch.end < input.batch.start) {
    throw new BatchExportError('"จบ" ต้องมากกว่าหรือเท่ากับ "เริ่ม"')
  }
  if (input.batch.step < 1) {
    throw new BatchExportError('"ต่อชุด" ต้อง ≥ 1')
  }

  let baseImg: HTMLImageElement | null = null
  if (input.baseImageDataUrl) baseImg = await loadImage(input.baseImageDataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = RENDER_W
  canvas.height = RENDER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new BatchExportError('สร้าง canvas context ไม่สำเร็จ')

  const mimeType = input.batch.format === 'jpg' ? 'image/jpeg' : 'image/png'
  const ext = input.batch.format
  const quality = Math.max(0.1, Math.min(1, input.batch.quality / 100))

  const chapters: number[] = []
  for (let n = input.batch.start; n <= input.batch.end; n += input.batch.step) chapters.push(n)
  const total = chapters.length

  const failedFiles: string[] = []
  let successCount = 0

  for (let i = 0; i < chapters.length; i += 1) {
    if (shouldCancel()) throw new BatchExportError('ยกเลิกโดยผู้ใช้')
    const chapter = chapters[i]
    const padded = formatChapterNumber(chapter, input.batch.padding)
    const fileName = `${padded}.${ext}`
    onProgress({ current: i, total, chapter, fileName })

    try {
      drawCover(ctx, {
        baseImage: baseImg,
        background: input.background,
        foreground: input.foreground,
        title: input.title,
        chapter: input.chapter,
        chapterNumber: chapter,
        padding: input.batch.padding,
      })
      const dataUrl = canvas.toDataURL(mimeType, quality)
      const base64 = dataUrlToBase64(dataUrl)
      const targetPath = joinPath(input.batch.outputFolder, fileName)
      const res = await writeBytes(targetPath, base64)
      if (res && !res.ok) throw new Error(res.error ?? 'writeBytes returned ok:false')
      successCount += 1
      await tick()
    } catch (err) {
      failedFiles.push(fileName)
      // eslint-disable-next-line no-console
      console.warn('[batchExport] failed', fileName, err)
    }
  }

  onProgress({
    current: total,
    total,
    chapter: chapters[chapters.length - 1] ?? 0,
    fileName: '',
  })

  return {
    outputFolder: input.batch.outputFolder,
    totalFiles: total,
    successCount,
    failedFiles,
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new BatchExportError('โหลดภาพไม่สำเร็จ'))
    img.src = dataUrl
  })
}

function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function joinPath(folder: string, name: string): string {
  const trimmed = folder.replace(/[\\/]+$/u, '')
  const sep = trimmed.includes('\\') ? '\\' : '/'
  return `${trimmed}${sep}${name}`
}
