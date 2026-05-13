/**
 * coverRender — วาดปก video frame (1280×720) บน Canvas2D
 *
 * Pipeline:
 *   1. วาด baseImage cover-fit เต็ม canvas (จะถูก blur ทับด้วย filter)
 *   2. blur filter + dark dim overlay
 *   3. วาด foreground cover (ภาพเดียวกัน — ไม่ blur) เป็น "ปก" ตรงกลาง/ซ้าย
 *   4. วาด title text layer
 *   5. วาด chapter text layer (replace {n} ด้วยเลขตอน)
 */

import type { BackgroundConfig, ForegroundConfig, TextLayer } from './useCoverState'

export type DrawCoverOptions = {
  baseImage: HTMLImageElement | null
  background: BackgroundConfig
  foreground: ForegroundConfig
  title: TextLayer
  chapter: TextLayer
  /** เลขตอนปัจจุบัน — ใช้ replace {n} */
  chapterNumber: number
  /** จำนวนหลักของศูนย์เติม (จาก batch config) */
  padding: number
}

export function formatChapterNumber(n: number, padding: number): string {
  const s = String(Math.max(0, Math.floor(n)))
  return padding <= s.length ? s : s.padStart(padding, '0')
}

export function resolveChapterText(template: string, chapterNumber: number, padding: number): string {
  const numStr = formatChapterNumber(chapterNumber, padding)
  return template.replace(/\{n\}/gu, numStr)
}

export function drawCover(ctx: CanvasRenderingContext2D, opts: DrawCoverOptions) {
  const canvas = ctx.canvas
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)

  // ─── 1. Background (blurred + dimmed) ───────────────────────────────────
  if (opts.baseImage && opts.baseImage.complete && opts.baseImage.naturalWidth > 0) {
    drawCoverFit(ctx, opts.baseImage, 0, 0, W, H, opts.background.blur)
  } else {
    // fallback amber gradient
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#78350F')
    g.addColorStop(0.5, '#B45309')
    g.addColorStop(1, '#F59E0B')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  if (opts.background.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${opts.background.dim})`
    ctx.fillRect(0, 0, W, H)
  }

  // ─── 2. Foreground cover (centered/left, not blurred) ───────────────────
  if (opts.foreground.show && opts.baseImage && opts.baseImage.complete && opts.baseImage.naturalWidth > 0) {
    drawForegroundCover(ctx, opts.baseImage, opts.foreground, W, H)
  }

  // ─── 3. Title text ──────────────────────────────────────────────────────
  if (opts.title.text) {
    drawTextLayer(ctx, opts.title, opts.title.text, W, H)
  }

  // ─── 4. Chapter text ────────────────────────────────────────────────────
  if (opts.chapter.text) {
    const resolved = resolveChapterText(opts.chapter.text, opts.chapterNumber, opts.padding)
    drawTextLayer(ctx, opts.chapter, resolved, W, H)
  }
}

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  blurPx: number,
) {
  const ratio = img.naturalWidth / img.naturalHeight
  const target = dw / dh
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  if (ratio > target) {
    sw = img.naturalHeight * target
    sx = (img.naturalWidth - sw) / 2
  } else if (ratio < target) {
    sh = img.naturalWidth / target
    sy = (img.naturalHeight - sh) / 2
  }
  ctx.save()
  // canvas filter ทำงานบน Chromium (Electron) ครบ
  ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none'
  // ขยาย dest นิดหน่อยกัน edge ขาวจาก blur
  const pad = blurPx > 0 ? Math.ceil(blurPx * 1.5) : 0
  ctx.drawImage(img, sx, sy, sw, sh, dx - pad, dy - pad, dw + pad * 2, dh + pad * 2)
  ctx.restore()
}

function drawForegroundCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fg: ForegroundConfig,
  W: number,
  H: number,
) {
  // ปก foreground = portrait 2:3 — สูงตาม scale ของ canvas height
  const fgH = H * Math.max(0.1, Math.min(1, fg.scale))
  const fgW = fgH * (2 / 3)
  const cx = (fg.xPercent / 100) * W
  const cy = (fg.yPercent / 100) * H
  const x = cx - fgW / 2
  const y = cy - fgH / 2

  ctx.save()
  if (fg.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 10
  }

  const r = Math.max(0, fg.cornerRadius)
  if (r > 0) {
    roundedRectPath(ctx, x, y, fgW, fgH, r)
    ctx.save()
    ctx.clip()
    drawCoverFit(ctx, img, x, y, fgW, fgH, 0)
    ctx.restore()
    // re-stroke border ที่ขอบ
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.stroke()
  } else {
    drawCoverFit(ctx, img, x, y, fgW, fgH, 0)
  }
  ctx.restore()
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  text: string,
  W: number,
  H: number,
) {
  const x = (layer.xPercent / 100) * W
  const y = (layer.yPercent / 100) * H
  ctx.save()
  ctx.font = `${layer.weight} ${layer.fontSize}px Tahoma, "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = layer.align
  ctx.textBaseline = 'middle'
  if (layer.stroke) {
    ctx.lineWidth = Math.max(2, Math.round(layer.fontSize / 14))
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = layer.color
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf('base64,')
  return idx >= 0 ? dataUrl.slice(idx + 7) : ''
}
