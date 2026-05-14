import type { RefObject } from 'react'
import * as fabric from 'fabric'
import {
  CANVAS_W,
  CANVAS_H,
  DEFAULT_COVER_RATIO_PRESET,
  DEFAULT_LAYER_ADJUSTMENTS,
  type InkLayerKind,
  type InkideaTransformDefaults,
  type LayerAdjustments,
  type TemplateBgBlurOpts,
} from './coverEditorTypes'

export type ImagePickSource = { kind: 'path'; value: string } | { kind: 'file'; value: File }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pickImageSourceAsync(electron: any, imagePickerRef: RefObject<HTMLInputElement | null>): Promise<ImagePickSource | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const electronAny = electron as any
  if (typeof electronAny?.selectFiles === 'function' && typeof electronAny?.readFileAsDataUrl === 'function') {
    const selected = await electronAny.selectFiles({
      properties: ['openFile'],
      filters: [{ name: 'ไฟล์ภาพ', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    const filePath = selected[0]
    return filePath ? { kind: 'path', value: filePath } : null
  }
  const input = imagePickerRef.current
  if (!input) throw new Error('ไม่พบตัวเลือกไฟล์ภาพบนหน้าจอ')
  return new Promise((resolve) => {
    input.value = ''
    input.onchange = () => {
      const nextFile = input.files?.[0]
      resolve(nextFile ? { kind: 'file', value: nextFile } : null)
    }
    input.click()
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function imageSourceToDataUrlAsync(source: ImagePickSource, electron: any): Promise<string> {
  if (source.kind === 'file') return readBrowserFileAsDataUrl(source.value)
  if (!electron?.readFileAsDataUrl)
    throw new Error('ไม่สามารถอ่านไฟล์จากดิสก์ได้: preload ยังไม่พร้อม')
  return electron.readFileAsDataUrl({ filePath: source.value })
}

export function newId(): string {
  const anyCrypto = typeof crypto !== 'undefined' ? crypto : undefined
  return (anyCrypto as { randomUUID?: () => string } | undefined)?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n))
}

export function withDirSep(dir: string): string {
  if (!dir) return ''
  if (dir.endsWith('\\') || dir.endsWith('/')) return dir
  const sep = dir.includes('\\') ? '\\' : '/'
  return `${dir}${sep}`
}

export function zeroPad(num: number, places: number): string {
  const safePlaces = Math.max(1, Math.floor(places))
  const s = Math.floor(Math.max(0, num)).toString()
  return s.padStart(safePlaces, '0')
}

export function formatLoadError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
  }
}

export function readBrowserFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('ไม่สามารถอ่านไฟล์ภาพที่เลือกได้'))
    }
    reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดระหว่างอ่านไฟล์ภาพ'))
    reader.readAsDataURL(file)
  })
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('ไม่สามารถโหลดข้อมูลภาพที่เลือกได้'))
    img.src = src
  })
}

export async function createBlurredBackgroundDataUrl(
  src: string,
  opts: TemplateBgBlurOpts,
): Promise<string> {
  const img = await loadImageElement(src)
  const blurPx = clamp(opts.blurPx, 0, 80)
  const pad = Math.ceil(blurPx * 2.5 + 12)
  const tempW = CANVAS_W + pad * 2
  const tempH = CANVAS_H + pad * 2

  const temp = document.createElement('canvas')
  temp.width = tempW
  temp.height = tempH
  const ctx = temp.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถสร้างภาพพื้นหลังเบลอได้')

  const nw = img.naturalWidth || img.width
  const nh = img.naturalHeight || img.height
  const scale = Math.max(CANVAS_W / nw, CANVAS_H / nh)
  const drawW = nw * scale
  const drawH = nh * scale
  const drawX = (tempW - drawW) / 2
  const drawY = (tempH - drawH) / 2

  const b = clamp(opts.brightness, 0.2, 1)
  const sat = clamp(opts.saturate, 0.5, 2)
  ctx.filter = `blur(${blurPx}px) brightness(${b}) saturate(${sat})`
  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.filter = 'none'

  const out = document.createElement('canvas')
  out.width = CANVAS_W
  out.height = CANVAS_H
  const octx = out.getContext('2d')
  if (!octx) throw new Error('ไม่สามารถสร้างภาพพื้นหลังเบลอได้')
  octx.drawImage(temp, pad, pad, CANVAS_W, CANVAS_H, 0, 0, CANVAS_W, CANVAS_H)
  const ov = clamp(opts.overlayAlpha, 0, 0.55)
  if (ov > 0) {
    octx.fillStyle = `rgba(0,0,0,${ov})`
    octx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }
  return out.toDataURL('image/png')
}

export async function cropImageDataUrlToRatio(src: string, ratio: number): Promise<string> {
  const img = await loadImageElement(src)
  const sourceW = img.naturalWidth || img.width
  const sourceH = img.naturalHeight || img.height
  if (!sourceW || !sourceH) throw new Error('อ่านขนาดภาพไม่ได้')
  const sourceRatio = sourceW / sourceH
  let sx = 0, sy = 0, sw = sourceW, sh = sourceH
  let outW = sourceW, outH = Math.round(sourceW / ratio)
  if (sourceRatio > ratio) {
    // source wider than target → crop sides
    sw = sourceH * ratio
    sx = (sourceW - sw) / 2
    outW = Math.round(sourceH * ratio)
    outH = sourceH
  } else if (sourceRatio < ratio) {
    // source taller than target → crop top/bottom
    sh = sourceW / ratio
    sy = (sourceH - sh) / 2
    outW = sourceW
    outH = Math.round(sourceW / ratio)
  }
  const out = document.createElement('canvas')
  out.width = Math.max(1, outW)
  out.height = Math.max(1, outH)
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถครอปภาพได้')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

export async function cropImageDataUrlToCoverRatio(src: string): Promise<string> {
  const img = await loadImageElement(src)
  const sourceW = img.naturalWidth || img.width
  const sourceH = img.naturalHeight || img.height
  if (!sourceW || !sourceH) throw new Error('อ่านขนาดภาพไม่ได้')

  const targetRatio = DEFAULT_COVER_RATIO_PRESET.width / DEFAULT_COVER_RATIO_PRESET.height
  const sourceRatio = sourceW / sourceH
  let sx = 0
  let sy = 0
  let sw = sourceW
  let sh = sourceH

  if (sourceRatio > targetRatio) {
    sw = sourceH * targetRatio
    sx = (sourceW - sw) / 2
  } else if (sourceRatio < targetRatio) {
    sh = sourceW / targetRatio
    sy = (sourceH - sh) / 2
  }

  const out = document.createElement('canvas')
  out.width = Math.round(sourceH * targetRatio)
  out.height = sourceH
  if (sourceRatio < targetRatio) {
    out.width = sourceW
    out.height = Math.round(sourceW / targetRatio)
  }
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถครอปภาพปกได้')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

export function canvasBgGradient(
  direction: 'vertical' | 'horizontal',
  from: string,
  to: string,
): fabric.Gradient<'linear'> {
  return new fabric.Gradient({
    type: 'linear',
    gradientUnits: 'pixels',
    coords:
      direction === 'vertical'
        ? { x1: 0, y1: 0, x2: 0, y2: CANVAS_H }
        : { x1: 0, y1: 0, x2: CANVAS_W, y2: 0 },
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  })
}

export function stampInkideaTransformDefaults(obj: fabric.Object): void {
  const o = obj as fabric.Object & InkideaTransformDefaults
  o.inkideaDefaultLeft = obj.left
  o.inkideaDefaultTop = obj.top
  o.inkideaDefaultAngle = obj.angle ?? 0
  o.inkideaDefaultScaleX = obj.scaleX ?? 1
  o.inkideaDefaultScaleY = obj.scaleY ?? 1
  o.inkideaDefaultSkewX = obj.skewX ?? 0
  o.inkideaDefaultSkewY = obj.skewY ?? 0
  o.inkideaDefaultOriginX = obj.originX
  o.inkideaDefaultOriginY = obj.originY
}

export function ensureInkideaTransformDefaults(obj: fabric.Object): void {
  const kind = (obj as fabric.Object & { inkideaLayerKind?: InkLayerKind }).inkideaLayerKind
  if (kind === 'background') return
  const d = obj as fabric.Object & InkideaTransformDefaults
  if (typeof d.inkideaDefaultLeft !== 'number' || typeof d.inkideaDefaultTop !== 'number') {
    stampInkideaTransformDefaults(obj)
  }
}

/**
 * Resize a Textbox so the bounding/selection box hugs the text instead of staying
 * at the original `width`. Wrap point is implicitly disabled (text auto-grows on edit).
 * Call after constructing the textbox AND after `text` is changed (or hook into the
 * `text:changed` canvas event).
 */
/**
 * Smart-format an episode label so users can type loose input like "1", "1-50",
 * "1 - 50", "ตอน 1" and get a cleanly padded result like "001", "001-050".
 *
 * - Pure single number → padded to `pad` digits (default 3).
 * - "a-b" / "a—b" / "a to b" / "a..b" → "AAA-BBB" (each side padded).
 * - Anything else (no digits or mixed text) → trimmed input as-is.
 */
export function smartFormatEpisode(input: string, pad = 3): string {
  if (input == null) return ''
  const raw = String(input).trim()
  if (!raw) return ''
  const padNum = (s: string) => {
    const digits = s.replace(/\D+/g, '')
    if (!digits) return s
    return digits.padStart(Math.max(pad, digits.length), '0')
  }
  // Range: pull first two integer groups, separated by - – — to .. — keep en-dash output.
  const m = raw.match(/^\D*?(\d+)\s*[-–—]+\s*(\d+)\D*$/u)
    ?? raw.match(/^\D*?(\d+)\s*\.{2,}\s*(\d+)\D*$/u)
    ?? raw.match(/^\D*?(\d+)\s+(?:to|ถึง)\s+(\d+)\D*$/iu)
  if (m) return `${padNum(m[1])}-${padNum(m[2])}`
  // Single number — strip any prefix label like "ตอน"
  const single = raw.match(/^\D*?(\d+)\D*$/u)
  if (single) return padNum(single[1])
  return raw
}

export function tightenTextboxWidth(tb: fabric.Textbox): void {
  try {
    const measure = (tb as fabric.Textbox & { calcTextWidth?: () => number }).calcTextWidth
    const next = typeof measure === 'function' ? measure.call(tb) : tb.width ?? 0
    const padding = (tb.padding ?? 0) * 2
    tb.set({ width: Math.max(next + padding + 4, 24) })
    tb.setCoords()
  } catch {
    // measurement may fail before mounting; ignore
  }
}

export function textObjectGradientForTextbox(
  tb: fabric.Textbox,
  direction: 'vertical' | 'horizontal',
  from: string,
  to: string,
): fabric.Gradient<'linear'> {
  tb.initDimensions()
  const lw = Math.max(tb.width || 100, 8)
  const lh = Math.max(tb.calcTextHeight(), 8)
  return new fabric.Gradient({
    type: 'linear',
    gradientUnits: 'pixels',
    coords:
      direction === 'vertical'
        ? { x1: 0, y1: 0, x2: 0, y2: lh }
        : { x1: 0, y1: 0, x2: lw, y2: 0 },
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  })
}

export function exportPngDataUrlWithQuality(canvas: fabric.Canvas, q: number): string {
  // quality 1-100 maps to output multiplier 1x-2x (higher = sharper / higher resolution)
  const multiplier = 1 + Math.max(0, Math.min(100, q)) / 100
  return canvas.toDataURL({ format: 'png', multiplier })
}

export async function createFabricImageFromDataUrl(dataUrl: string): Promise<fabric.Image> {
  const imgEl = await loadImageElement(dataUrl)
  return new fabric.Image(imgEl)
}

export function getFabricObjectById<T extends fabric.Object>(
  canvas: fabric.Canvas | null,
  id: string | null
): T | null {
  if (!canvas || !id) return null
  return ((canvas.getObjects().find((o: any) => (o as any).inkideaLayerId === id) as T | undefined) ?? null)
}

export function reorderFabricObjectToBack(canvas: fabric.Canvas, obj: fabric.Object): void {
  const stack = ((canvas as any)._objects as fabric.Object[]) ?? []
  const idx = stack.indexOf(obj)
  if (idx <= 0) return
  stack.splice(idx, 1)
  stack.unshift(obj)
  canvas.requestRenderAll()
}

// ---------------------------------------------------------------------------
// Per-layer adjustments (Photoshop-style filter stack)
// ---------------------------------------------------------------------------

export function readAdjustmentsFromObject(obj: fabric.Object | null | undefined): LayerAdjustments {
  if (!obj) return { ...DEFAULT_LAYER_ADJUSTMENTS }
  const stored = (obj as fabric.Object & { inkideaAdjustments?: Partial<LayerAdjustments> })
    .inkideaAdjustments
  return { ...DEFAULT_LAYER_ADJUSTMENTS, ...(stored ?? {}) }
}

export function hexToRgba(color: string, alpha: number): string {
  const a = clamp(alpha, 0, 1)
  if (color.startsWith('rgb')) return color.replace(/[\d.]+\)$/, `${a})`)
  const hex = color.replace('#', '').trim()
  const norm = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const num = Number.parseInt(norm.slice(0, 6) || '000000', 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `rgba(${r},${g},${b},${a})`
}

export function applyAdjustmentsToObject(obj: fabric.Object, adj: LayerAdjustments): void {
  ;(obj as fabric.Object & { inkideaAdjustments?: LayerAdjustments }).inkideaAdjustments = { ...adj }
  obj.set({ globalCompositeOperation: adj.blendMode } as Partial<fabric.Object>)

  if (obj instanceof fabric.Image) {
    const F = (fabric as unknown as { filters: Record<string, new (opts?: object) => unknown> }).filters
    const filters: unknown[] = []
    // Hard-cap blur at 0.2 — fabric uses `blur * imgDimension` as the convolution radius,
    // and anything past ~0.25 produces a kernel large enough to render the cache as black.
    if (adj.blur > 0.001 && F.Blur) filters.push(new F.Blur({ blur: clamp(adj.blur, 0, 0.2) }))
    if (Math.abs(adj.brightness) > 0.001 && F.Brightness)
      filters.push(new F.Brightness({ brightness: clamp(adj.brightness, -1, 1) }))
    if (Math.abs(adj.contrast) > 0.001 && F.Contrast)
      filters.push(new F.Contrast({ contrast: clamp(adj.contrast, -1, 1) }))
    if (Math.abs(adj.saturation) > 0.001 && F.Saturation)
      filters.push(new F.Saturation({ saturation: clamp(adj.saturation, -1, 1) }))
    if (Math.abs(adj.hue) > 0.001 && F.HueRotation)
      filters.push(new F.HueRotation({ rotation: clamp(adj.hue, -1, 1) }))
    if (adj.overlayAlpha > 0.001 && F.BlendColor) {
      filters.push(new F.BlendColor({ color: adj.overlayColor, mode: 'tint', alpha: clamp(adj.overlayAlpha, 0, 1) }))
    }
    const img = obj as fabric.Image
    img.filters = filters as fabric.Image['filters']
    try {
      img.applyFilters()
    } catch {
      // Filter pipeline failure (e.g., huge kernel, lost WebGL context) — strip filters
      // so the source image still renders rather than leaving a black cache behind.
      img.filters = []
      try { img.applyFilters() } catch { /* ignore */ }
    }
  }

  if (adj.shadowBlur > 0.5) {
    obj.set('shadow', new fabric.Shadow({
      color: hexToRgba(adj.shadowColor, 0.7),
      blur: adj.shadowBlur,
      offsetX: 0,
      offsetY: 0,
    }) as fabric.Shadow)
  } else {
    obj.set('shadow', null)
  }
  obj.set('dirty', true)
}

export function reapplyAdjustmentsForCanvas(canvas: fabric.Canvas | null): void {
  if (!canvas) return
  for (const o of canvas.getObjects()) {
    const adj = (o as fabric.Object & { inkideaAdjustments?: LayerAdjustments }).inkideaAdjustments
    if (adj) applyAdjustmentsToObject(o, { ...DEFAULT_LAYER_ADJUSTMENTS, ...adj })
  }
  canvas.requestRenderAll()
}

export function reorderFabricObjectStep(canvas: fabric.Canvas, obj: fabric.Object, delta: number): void {
  const stack = ((canvas as any)._objects as fabric.Object[]) ?? []
  const idx = stack.indexOf(obj)
  if (idx === -1) return
  const clampValue = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b)
  const next = clampValue(idx + delta, 0, Math.max(0, stack.length - 1))
  if (next === idx) return
  stack.splice(idx, 1)
  stack.splice(next, 0, obj)
  canvas.requestRenderAll()
}
