/**
 * Real integration test ของ batchExport — ใช้ @napi-rs/canvas + เขียน PNG จริงลง temp dir
 *
 * Coverage:
 *   - batch loop เขียนไฟล์ครบทุก chapter ใน range
 *   - ไฟล์ทุกตัวเป็น PNG valid (signature ถูก) + ขนาด > 1KB
 *   - chapter number padding ตรงในชื่อไฟล์
 *   - step > 1 → เลขข้าม
 *   - format=jpg → ไฟล์ JPEG signature
 *   - cancel ระหว่างทำงาน → throw + ไฟล์ที่ทำไปแล้วยังอยู่
 *   - writeBytes fail → นับเป็น failedFiles + ไม่ throw
 */

// @vitest-environment node

import { createCanvas } from '@napi-rs/canvas'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { runBatchExport, BatchExportError } from '../batchExport'
import {
  DEFAULT_BG,
  DEFAULT_FG,
  DEFAULT_TITLE,
  DEFAULT_CHAPTER,
  type BatchConfig,
} from '../useCoverState'

let tmpDir: string

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPG_SOI = Buffer.from([0xff, 0xd8])

function makeBatch(over: Partial<BatchConfig> = {}): BatchConfig {
  return {
    start: 1,
    end: 3,
    step: 1,
    padding: 3,
    outputFolder: tmpDir,
    format: 'png',
    quality: 92,
    ...over,
  }
}

/** patch document.createElement('canvas') ให้ใช้ @napi-rs/canvas + writeBytes ลง disk จริง */
function installCanvasShim() {
  // @ts-expect-error — provide minimal document for node env
  globalThis.document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`unsupported tag: ${tag}`)
      const c = createCanvas(1, 1) as unknown as {
        width: number
        height: number
        getContext: (kind: string) => CanvasRenderingContext2D
        toDataURL: (mime?: string, q?: number) => string
      }
      // toDataURL ใช้ buffer → base64
      const napiCanvas = c as unknown as {
        toBuffer: (mime?: string, quality?: number) => Buffer
      }
      ;(c as unknown as Record<string, unknown>).toDataURL = (mime?: string, q?: number) => {
        // @napi-rs/canvas quality range 0-100; HTMLCanvasElement is 0-1
        const napiQ = q !== undefined ? Math.round(q * 100) : undefined
        const buf = napiCanvas.toBuffer(mime ?? 'image/png', napiQ)
        return `data:${mime ?? 'image/png'};base64,${buf.toString('base64')}`
      }
      return c as unknown as HTMLCanvasElement
    },
  }

  // installer ของ window.inkstudio.fs.writeBytes — write to real disk
  ;(globalThis as unknown as { window: { inkstudio: unknown } }).window = {
    inkstudio: {
      fs: {
        writeBytes: async (p: string, base64: string) => {
          try {
            fs.mkdirSync(path.dirname(p), { recursive: true })
            fs.writeFileSync(p, Buffer.from(base64, 'base64'))
            return { ok: true as const }
          } catch (err) {
            return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
          }
        },
      },
    },
  }
}

function installFailingWriteBytes(failOnIndex: number) {
  let i = 0
  ;(globalThis as unknown as { window: { inkstudio: unknown } }).window = {
    inkstudio: {
      fs: {
        writeBytes: async (p: string, base64: string) => {
          i += 1
          if (i === failOnIndex) {
            return { ok: false as const, error: 'simulated disk full' }
          }
          fs.mkdirSync(path.dirname(p), { recursive: true })
          fs.writeFileSync(p, Buffer.from(base64, 'base64'))
          return { ok: true as const }
        },
      },
    },
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkstudio-batch-'))
  installCanvasShim()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('runBatchExport — real disk writes', () => {
  it('เขียนไฟล์ครบทุก chapter ใน range — ไฟล์เป็น PNG valid จริง', async () => {
    const result = await runBatchExport(
      {
        baseImageDataUrl: null,
        background: DEFAULT_BG,
        foreground: { ...DEFAULT_FG, show: false },
        title: DEFAULT_TITLE,
        chapter: DEFAULT_CHAPTER,
        batch: makeBatch({ start: 1, end: 5 }),
      },
      () => undefined,
      () => false,
    )
    expect(result.totalFiles).toBe(5)
    expect(result.successCount).toBe(5)
    expect(result.failedFiles).toEqual([])

    const files = fs.readdirSync(tmpDir).sort()
    expect(files).toEqual(['001.png', '002.png', '003.png', '004.png', '005.png'])
    for (const f of files) {
      const buf = fs.readFileSync(path.join(tmpDir, f))
      expect(buf.length).toBeGreaterThan(1024)
      expect(buf.subarray(0, 8).equals(PNG_SIG)).toBe(true)
    }
  })

  it('padding=4 → 0001.png, 0002.png, ...', async () => {
    await runBatchExport(
      {
        baseImageDataUrl: null,
        background: DEFAULT_BG,
        foreground: { ...DEFAULT_FG, show: false },
        title: DEFAULT_TITLE,
        chapter: DEFAULT_CHAPTER,
        batch: makeBatch({ start: 7, end: 10, padding: 4 }),
      },
      () => undefined,
      () => false,
    )
    const files = fs.readdirSync(tmpDir).sort()
    expect(files).toEqual(['0007.png', '0008.png', '0009.png', '0010.png'])
  })

  it('step=3 → chapters 1, 4, 7, 10', async () => {
    await runBatchExport(
      {
        baseImageDataUrl: null,
        background: DEFAULT_BG,
        foreground: { ...DEFAULT_FG, show: false },
        title: DEFAULT_TITLE,
        chapter: DEFAULT_CHAPTER,
        batch: makeBatch({ start: 1, end: 10, step: 3 }),
      },
      () => undefined,
      () => false,
    )
    const files = fs.readdirSync(tmpDir).sort()
    expect(files).toEqual(['001.png', '004.png', '007.png', '010.png'])
  })

  it('format=jpg → ไฟล์ JPEG valid (SOI marker)', async () => {
    await runBatchExport(
      {
        baseImageDataUrl: null,
        background: DEFAULT_BG,
        foreground: { ...DEFAULT_FG, show: false },
        title: DEFAULT_TITLE,
        chapter: DEFAULT_CHAPTER,
        batch: makeBatch({ start: 1, end: 2, format: 'jpg' }),
      },
      () => undefined,
      () => false,
    )
    const files = fs.readdirSync(tmpDir).sort()
    expect(files).toEqual(['001.jpg', '002.jpg'])
    for (const f of files) {
      const buf = fs.readFileSync(path.join(tmpDir, f))
      expect(buf.length).toBeGreaterThan(1024)
      expect(buf.subarray(0, 2).equals(JPG_SOI)).toBe(true)
    }
  })

  it('onProgress ส่งครบทุก chapter + final', async () => {
    const progress: Array<{ current: number; total: number; chapter: number; fileName: string }> = []
    await runBatchExport(
      {
        baseImageDataUrl: null,
        background: DEFAULT_BG,
        foreground: { ...DEFAULT_FG, show: false },
        title: DEFAULT_TITLE,
        chapter: DEFAULT_CHAPTER,
        batch: makeBatch({ start: 1, end: 3 }),
      },
      (p) => progress.push({ current: p.current, total: p.total, chapter: p.chapter, fileName: p.fileName }),
      () => false,
    )
    expect(progress.length).toBe(4) // 3 chapters + final summary
    expect(progress[0]).toMatchObject({ current: 0, total: 3, chapter: 1, fileName: '001.png' })
    expect(progress[1]).toMatchObject({ current: 1, total: 3, chapter: 2, fileName: '002.png' })
    expect(progress[3]).toMatchObject({ current: 3, total: 3 })
  })
})

describe('runBatchExport — error paths', () => {
  it('outputFolder ว่าง → throw BatchExportError', async () => {
    await expect(
      runBatchExport(
        {
          baseImageDataUrl: null,
          background: DEFAULT_BG,
          foreground: { ...DEFAULT_FG, show: false },
          title: DEFAULT_TITLE,
          chapter: DEFAULT_CHAPTER,
          batch: makeBatch({ outputFolder: '' }),
        },
        () => undefined,
        () => false,
      ),
    ).rejects.toThrow(BatchExportError)
  })

  it('end < start → throw', async () => {
    await expect(
      runBatchExport(
        {
          baseImageDataUrl: null,
          background: DEFAULT_BG,
          foreground: { ...DEFAULT_FG, show: false },
          title: DEFAULT_TITLE,
          chapter: DEFAULT_CHAPTER,
          batch: makeBatch({ start: 10, end: 5 }),
        },
        () => undefined,
        () => false,
      ),
    ).rejects.toThrow(/จบ/u)
  })

  it('step < 1 → throw', async () => {
    await expect(
      runBatchExport(
        {
          baseImageDataUrl: null,
          background: DEFAULT_BG,
          foreground: { ...DEFAULT_FG, show: false },
          title: DEFAULT_TITLE,
          chapter: DEFAULT_CHAPTER,
          batch: makeBatch({ step: 0 }),
        },
        () => undefined,
        () => false,
      ),
    ).rejects.toThrow(/ต่อชุด/u)
  })

  it('cancel กลางคัน → throw + ไฟล์ที่เสร็จไปแล้วยังอยู่', async () => {
    let calls = 0
    await expect(
      runBatchExport(
        {
          baseImageDataUrl: null,
          background: DEFAULT_BG,
          foreground: { ...DEFAULT_FG, show: false },
          title: DEFAULT_TITLE,
          chapter: DEFAULT_CHAPTER,
          batch: makeBatch({ start: 1, end: 100 }),
        },
        () => {
          calls += 1
        },
        () => calls >= 3, // cancel หลัง progress 3 ครั้ง
      ),
    ).rejects.toThrow(/ยกเลิก/u)

    const files = fs.readdirSync(tmpDir)
    expect(files.length).toBeGreaterThan(0)
    expect(files.length).toBeLessThan(100) // ไม่ได้เขียนครบ
  })

  it('writeBytes fail → นับเป็น failedFiles, ไม่ throw, ทำต่อ', async () => {
    installFailingWriteBytes(2) // fail ไฟล์ที่ 2
    const result = await runBatchExport(
      {
        baseImageDataUrl: null,
        background: DEFAULT_BG,
        foreground: { ...DEFAULT_FG, show: false },
        title: DEFAULT_TITLE,
        chapter: DEFAULT_CHAPTER,
        batch: makeBatch({ start: 1, end: 3 }),
      },
      () => undefined,
      () => false,
    )
    expect(result.successCount).toBe(2)
    expect(result.failedFiles).toEqual(['002.png'])
    expect(result.totalFiles).toBe(3)
    const files = fs.readdirSync(tmpDir).sort()
    expect(files).toEqual(['001.png', '003.png'])
  })
})
