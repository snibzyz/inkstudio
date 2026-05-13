/**
 * drawCover — test ผ่าน mock CanvasRenderingContext2D
 *
 * ตรวจว่า drawCover เรียก context methods ในลำดับที่ถูก + ผ่าน opts ครบ:
 *   1. clearRect ทับทั้ง canvas
 *   2. ถ้ามี baseImage → drawImage (cover-fit) + ctx.filter = 'blur(Npx)'
 *   3. ถ้าไม่มี baseImage → createLinearGradient (amber fallback) + fillRect
 *   4. ถ้า background.dim > 0 → fillStyle dim + fillRect ทับ
 *   5. ถ้า foreground.show → drawImage อีกครั้ง + roundedRect path
 *   6. drawTextLayer(title) — font + strokeText (ถ้า stroke) + fillText
 *   7. drawTextLayer(chapter) — เหมือนกัน + replace {n}
 */

import { describe, expect, it } from 'vitest'
import { drawCover } from '../coverRender'
import type { BackgroundConfig, ForegroundConfig, TextLayer } from '../useCoverState'

type Call = { method: string; args: unknown[] }

function makeMockCtx(width: number, height: number) {
  const calls: Call[] = []
  const state: Record<string, unknown> = {
    filter: 'none',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineJoin: 'miter',
    miterLimit: 10,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  }
  const proxy = new Proxy(state, {
    get(target, prop) {
      if (prop === 'canvas') return { width, height }
      if (typeof prop !== 'string') return undefined
      if (prop in target) {
        return target[prop]
      }
      // method — return recorder
      return (...args: unknown[]) => {
        calls.push({ method: prop, args })
        if (prop === 'createLinearGradient') {
          return { addColorStop: (..._a: unknown[]) => { calls.push({ method: 'addColorStop', args: _a }) } }
        }
        return undefined
      }
    },
    set(target, prop, value) {
      if (typeof prop === 'string') target[prop] = value
      calls.push({ method: `set:${String(prop)}`, args: [value] })
      return true
    },
  })
  return { ctx: proxy as unknown as CanvasRenderingContext2D, calls, state }
}

const BG: BackgroundConfig = { blur: 16, dim: 0.5 }
const FG: ForegroundConfig = {
  show: true,
  scale: 0.7,
  xPercent: 30,
  yPercent: 50,
  cornerRadius: 8,
  shadow: true,
}
const TITLE: TextLayer = {
  text: 'นิยายเรื่อง',
  fontSize: 40,
  color: '#ffffff',
  xPercent: 60,
  yPercent: 40,
  align: 'left',
  stroke: true,
  weight: 700,
}
const CHAPTER: TextLayer = {
  text: 'ตอนที่ {n}',
  fontSize: 64,
  color: '#F59E0B',
  xPercent: 60,
  yPercent: 60,
  align: 'left',
  stroke: true,
  weight: 800,
}

describe('drawCover — pipeline', () => {
  it('clearRect ก่อนวาดทุกครั้ง', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: FG,
      title: TITLE,
      chapter: CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    expect(calls[0]).toMatchObject({ method: 'clearRect', args: [0, 0, 1280, 720] })
  })

  it('ไม่มี baseImage → ใช้ gradient fallback (amber)', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: FG,
      title: TITLE,
      chapter: CHAPTER,
      chapterNumber: 5,
      padding: 3,
    })
    const methods = calls.map((c) => c.method)
    expect(methods).toContain('createLinearGradient')
    expect(methods).toContain('addColorStop')
    expect(methods).toContain('fillRect')
  })

  it('background.dim > 0 → วาด overlay rgba(0,0,0,α)', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: TITLE,
      chapter: CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    const dimSet = calls.find((c) => c.method === 'set:fillStyle' && String(c.args[0]).includes('rgba(0,0,0'))
    expect(dimSet).toBeDefined()
    expect(String(dimSet!.args[0])).toContain('0.5')
  })

  it('chapter template {n} → replace ด้วยเลข padded', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: TITLE,
      chapter: CHAPTER,
      chapterNumber: 7,
      padding: 3,
    })
    const fillTexts = calls
      .filter((c) => c.method === 'fillText')
      .map((c) => String(c.args[0]))
    expect(fillTexts).toContain('ตอนที่ 007')
  })

  it('title text แสดง verbatim (ไม่ replace {n})', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: TITLE,
      chapter: CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    const fillTexts = calls
      .filter((c) => c.method === 'fillText')
      .map((c) => String(c.args[0]))
    expect(fillTexts).toContain('นิยายเรื่อง')
  })

  it('stroke=true → strokeText ก่อน fillText', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: TITLE,
      chapter: { ...CHAPTER, stroke: false },
      chapterNumber: 1,
      padding: 3,
    })
    // หา fillText ของ title (นิยายเรื่อง) — ก่อนหน้าควรมี strokeText
    const titleFillIdx = calls.findIndex(
      (c) => c.method === 'fillText' && c.args[0] === 'นิยายเรื่อง',
    )
    const titleStrokeIdx = calls.findIndex(
      (c) => c.method === 'strokeText' && c.args[0] === 'นิยายเรื่อง',
    )
    expect(titleStrokeIdx).toBeGreaterThan(-1)
    expect(titleStrokeIdx).toBeLessThan(titleFillIdx)
  })

  it('stroke=false → ไม่มี strokeText', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: { ...TITLE, stroke: false, text: 'NoStroke' },
      chapter: { ...CHAPTER, stroke: false },
      chapterNumber: 1,
      padding: 3,
    })
    const noStrokeTitle = calls.find(
      (c) => c.method === 'strokeText' && c.args[0] === 'NoStroke',
    )
    expect(noStrokeTitle).toBeUndefined()
  })

  it('foreground.show=false → ไม่วาด fg cover', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: TITLE,
      chapter: CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    // ไม่ควรมี roundedRect ที่เกิดจาก foreground cover (moveTo/lineTo/quadraticCurveTo)
    const hasQuadratic = calls.some((c) => c.method === 'quadraticCurveTo')
    expect(hasQuadratic).toBe(false)
  })

  it('font string ตรงตาม weight + fontSize + family', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: { ...TITLE, fontSize: 48, weight: 700 },
      chapter: CHAPTER,
      chapterNumber: 1,
      padding: 3,
    })
    const fontSets = calls.filter((c) => c.method === 'set:font').map((c) => String(c.args[0]))
    expect(fontSets.some((f) => f.includes('700 48px') && f.includes('Tahoma'))).toBe(true)
  })

  it('text position คูณตาม xPercent/yPercent ของ canvas', () => {
    const { ctx, calls } = makeMockCtx(1280, 720)
    drawCover(ctx, {
      baseImage: null,
      background: BG,
      foreground: { ...FG, show: false },
      title: { ...TITLE, xPercent: 50, yPercent: 50, text: 'CenterTest' },
      chapter: { ...CHAPTER, text: '', stroke: false },
      chapterNumber: 1,
      padding: 3,
    })
    const fill = calls.find((c) => c.method === 'fillText' && c.args[0] === 'CenterTest')
    expect(fill).toBeDefined()
    expect(fill!.args[1]).toBe(640) // 50% ของ 1280
    expect(fill!.args[2]).toBe(360) // 50% ของ 720
  })
})
