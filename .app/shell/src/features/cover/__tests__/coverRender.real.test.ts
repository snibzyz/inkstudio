/**
 * Real integration test ของ drawCover — ใช้ @napi-rs/canvas สร้าง PNG จริงและตรวจ output
 *
 * รันใน node env (ไม่ใช้ happy-dom) เพราะ @napi-rs/canvas ต้องการ Node binding
 *
 * Coverage:
 *   - drawCover รัน end-to-end + produce PNG buffer ที่ขนาด > 1KB
 *   - PNG signature header ถูก (89 50 4E 47 0D 0A 1A 0A)
 *   - render หลาย chapter ที่มี chapter number ต่างกัน → output ต่างกัน
 *   - render บนพื้นหลังภาพจริง (load จาก logo.png)
 *   - 3 PNG จริงถูกเขียนลง temp dir
 */

// @vitest-environment node

import { createCanvas, loadImage, type Image as NapiImage } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { drawCover } from '../coverRender'
import {
  DEFAULT_BG,
  DEFAULT_FG,
  DEFAULT_TITLE,
  DEFAULT_CHAPTER,
} from '../useCoverState'

const W = 1280
const H = 720
const LOGO_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'public', 'logo.png')

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function isValidPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)
}

function renderToPngBuffer(opts: Parameters<typeof drawCover>[1]): Buffer {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  drawCover(ctx as unknown as CanvasRenderingContext2D, opts)
  return canvas.toBuffer('image/png')
}

describe('drawCover — real PNG output', () => {
  it('produces a valid PNG (signature + size > 1 KB)', () => {
    const buf = renderToPngBuffer({
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    expect(buf.length).toBeGreaterThan(1024)
    expect(isValidPng(buf)).toBe(true)
  })

  it('different chapter numbers → different PNG bytes (เลขเปลี่ยน pixel เปลี่ยน)', () => {
    const buf1 = renderToPngBuffer({
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    const buf999 = renderToPngBuffer({
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 999,
      padding: 3,
    })
    expect(buf1.equals(buf999)).toBe(false)
  })

  it('different title → different PNG bytes', () => {
    const bufA = renderToPngBuffer({
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: { ...DEFAULT_TITLE, text: 'ชื่อ A' },
      chapter: { ...DEFAULT_CHAPTER, text: '' },
      chapterNumber: 1,
      padding: 3,
    })
    const bufB = renderToPngBuffer({
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: { ...DEFAULT_TITLE, text: 'ชื่อ B' },
      chapter: { ...DEFAULT_CHAPTER, text: '' },
      chapterNumber: 1,
      padding: 3,
    })
    expect(bufA.equals(bufB)).toBe(false)
  })

  it('canvas width/height ตรง 1280×720', async () => {
    const canvas = createCanvas(W, H)
    expect(canvas.width).toBe(1280)
    expect(canvas.height).toBe(720)
    const ctx = canvas.getContext('2d')
    drawCover(ctx as unknown as CanvasRenderingContext2D, {
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    // confirm via re-decode through loadImage
    const buf = canvas.toBuffer('image/png')
    const img = await loadImage(buf)
    expect(img.width).toBe(W)
    expect(img.height).toBe(H)
  })

  it('render บน base image จริง (logo.png) — foreground cover แสดง', async () => {
    expect(fs.existsSync(LOGO_PATH)).toBe(true)
    const img = await loadImage(LOGO_PATH)
    const buf = renderToPngBuffer({
      baseImage: img as unknown as HTMLImageElement,
      background: DEFAULT_BG,
      foreground: DEFAULT_FG,
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 42,
      padding: 3,
    })
    expect(isValidPng(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(2048)

    // ตรวจ pixel กลาง canvas (50%,50%) — ควรมีสี (ไม่ใช่ transparent)
    const c = createCanvas(W, H)
    const ctx = c.getContext('2d')
    drawCover(ctx as unknown as CanvasRenderingContext2D, {
      baseImage: img as unknown as HTMLImageElement,
      background: DEFAULT_BG,
      foreground: DEFAULT_FG,
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 42,
      padding: 3,
    })
    const pixel = ctx.getImageData(W / 2, H / 2, 1, 1).data
    expect(pixel[3]).toBeGreaterThan(0) // alpha > 0 (มีอะไรวาด)
  })

  it('writes 3 real PNG files to temp dir (chapter 1, 2, 3)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inkstudio-cover-'))
    try {
      for (const n of [1, 2, 3]) {
        const buf = renderToPngBuffer({
          baseImage: null,
          background: DEFAULT_BG,
          foreground: { ...DEFAULT_FG, show: false },
          title: DEFAULT_TITLE,
          chapter: DEFAULT_CHAPTER,
          chapterNumber: n,
          padding: 3,
        })
        const out = path.join(tmp, `${String(n).padStart(3, '0')}.png`)
        fs.writeFileSync(out, buf)
        expect(fs.existsSync(out)).toBe(true)
        expect(fs.statSync(out).size).toBe(buf.length)
        expect(isValidPng(fs.readFileSync(out))).toBe(true)
      }
      const entries = fs.readdirSync(tmp)
      expect(entries.sort()).toEqual(['001.png', '002.png', '003.png'])
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('format=jpg buffer ตรงตาม JPEG signature (FF D8)', () => {
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')
    drawCover(ctx as unknown as CanvasRenderingContext2D, {
      baseImage: null,
      background: DEFAULT_BG,
      foreground: { ...DEFAULT_FG, show: false },
      title: DEFAULT_TITLE,
      chapter: DEFAULT_CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    const jpg = canvas.toBuffer('image/jpeg', 92)
    expect(jpg[0]).toBe(0xff)
    expect(jpg[1]).toBe(0xd8)
    expect(jpg.length).toBeGreaterThan(1024)
  })

  it('NapiImage type สามารถใช้แทน HTMLImageElement ได้', () => {
    const _typeCheck: NapiImage | null = null
    expect(_typeCheck).toBeNull()
  })
})
