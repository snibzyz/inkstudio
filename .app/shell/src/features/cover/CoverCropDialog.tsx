import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { IdeDialog } from '@shared/ui'
import {
  COVER_RATIO_PRESETS,
  DEFAULT_BACKGROUND_RATIO_PRESET,
  DEFAULT_COVER_RATIO_PRESET,
  DEFAULT_CREDIT_RATIO_PRESET,
} from './coverEditorTypes'

export type CoverCropKind = 'cover' | 'background' | 'credit'

type CoverCropDialogProps = {
  open: boolean
  imageDataUrl: string | null
  kind: CoverCropKind
  onClose: () => void
  onConfirm: (dataUrl: string) => void
}

function rotateSize(width: number, height: number, rotation: number) {
  const rot = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(rot) * width) + Math.abs(Math.sin(rot) * height),
    height: Math.abs(Math.sin(rot) * width) + Math.abs(Math.cos(rot) * height),
  }
}

async function transformImageDataUrl(
  imageDataUrl: string,
  rotation: number,
  flipX: boolean,
  flipY: boolean
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('โหลดภาพไม่สำเร็จ'))
    el.src = imageDataUrl
  })
  const rot = ((rotation % 360) + 360) % 360
  const baseW = img.naturalWidth || img.width
  const baseH = img.naturalHeight || img.height
  const size = rotateSize(baseW, baseH, rot)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(size.width))
  canvas.height = Math.max(1, Math.round(size.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถปรับภาพได้')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.drawImage(img, -baseW / 2, -baseH / 2)
  return canvas.toDataURL('image/png')
}

async function cropDataUrl(transformedDataUrl: string, area: Area): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('โหลดภาพไม่สำเร็จ'))
    el.src = transformedDataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width))
  canvas.height = Math.max(1, Math.round(area.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถสร้างภาพที่ครอปได้')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
  return canvas.toDataURL('image/png')
}

const DEFAULT_RATIO_BY_KIND = {
  cover: DEFAULT_COVER_RATIO_PRESET,
  background: DEFAULT_BACKGROUND_RATIO_PRESET,
  credit: DEFAULT_CREDIT_RATIO_PRESET,
} as const

const TITLE_BY_KIND = {
  cover: 'ครอปปก',
  background: 'ครอปพื้นหลัง',
  credit: 'ครอปเครดิต',
} as const

export function CoverCropDialog({ open, imageDataUrl, kind, onClose, onConfirm }: CoverCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const [ratioId, setRatioId] = useState<string>(DEFAULT_RATIO_BY_KIND[kind].id)
  const [customW, setCustomW] = useState<number>(DEFAULT_RATIO_BY_KIND[kind].width)
  const [customH, setCustomH] = useState<number>(DEFAULT_RATIO_BY_KIND[kind].height)
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ratio = useMemo(
    () => COVER_RATIO_PRESETS.find((preset) => preset.id === ratioId) ?? DEFAULT_RATIO_BY_KIND[kind],
    [kind, ratioId]
  )
  const aspect = ratio.id === 'custom'
    ? Math.max(0.05, customW) / Math.max(0.05, customH)
    : ratio.width / ratio.height
  const transformedImage = useMemo(() => {
    return imageDataUrl
  }, [imageDataUrl])

  const handleCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedPixels(pixels)
  }, [])

  const reset = useCallback(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setFlipX(false)
    setFlipY(false)
    setRatioId(DEFAULT_RATIO_BY_KIND[kind].id)
    setCustomW(DEFAULT_RATIO_BY_KIND[kind].width)
    setCustomH(DEFAULT_RATIO_BY_KIND[kind].height)
  }, [kind])

  useEffect(() => {
    if (!open) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setFlipX(false)
    setFlipY(false)
    setRatioId(DEFAULT_RATIO_BY_KIND[kind].id)
    setCustomW(DEFAULT_RATIO_BY_KIND[kind].width)
    setCustomH(DEFAULT_RATIO_BY_KIND[kind].height)
    setCroppedPixels(null)
    setError(null)
  }, [open, kind, imageDataUrl])

  const confirm = useCallback(async () => {
    if (!imageDataUrl || !croppedPixels || busy) return
    setBusy(true)
    setError(null)
    try {
      const transformed = await transformImageDataUrl(imageDataUrl, rotation, flipX, flipY)
      onConfirm(await cropDataUrl(transformed, croppedPixels))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [busy, croppedPixels, flipX, flipY, imageDataUrl, onConfirm, rotation])

  const quickRotate = useCallback((delta: number) => {
    setRotation((value) => value + delta)
  }, [])

  return (
    <IdeDialog
      open={open && Boolean(imageDataUrl)}
      onClose={busy ? () => {} : onClose}
      title={TITLE_BY_KIND[kind]}
      size="2xl"
      closeOnOverlayClick={!busy}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[12px] text-vscode-muted">{error}</div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-8 rounded-sm border border-vscode-border px-3 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="h-8 rounded-sm bg-vscode-button px-3 text-[12px] text-white hover:bg-vscode-button-hover disabled:opacity-50"
            >
              ใช้ปกนี้
            </button>
          </div>
        </div>
      }
    >
      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative h-[min(62vh,620px)] min-h-[320px] overflow-hidden border border-vscode-border bg-black">
          {imageDataUrl ? (
            <Cropper
              image={transformedImage ?? undefined}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
              transform={[
                `translate(${crop.x}px, ${crop.y}px)`,
                `rotate(${rotation}deg)`,
                `scale(${flipX ? -zoom : zoom}, ${flipY ? -zoom : zoom})`,
              ].join(' ')}
              showGrid
            />
          ) : null}
        </div>
        <aside className="space-y-3">
          <label className="block">
            <div className="mb-1 text-[11px] text-vscode-fg-dim">สัดส่วน</div>
            <select
              value={ratioId}
              onChange={(event) => setRatioId(event.target.value)}
              className="h-8 w-full rounded-sm border border-vscode-border bg-vscode-input px-2 text-[12px] text-vscode-fg outline-none focus:border-vscode-focus"
            >
              {COVER_RATIO_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {ratioId === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="mb-1 text-[11px] text-vscode-fg-dim">กว้าง</div>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={customW}
                  onChange={(event) => setCustomW(Number(event.target.value) || 1)}
                  className="h-8 w-full rounded-sm border border-vscode-border bg-vscode-input px-2 text-[12px] text-vscode-fg outline-none focus:border-vscode-focus"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[11px] text-vscode-fg-dim">สูง</div>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={customH}
                  onChange={(event) => setCustomH(Number(event.target.value) || 1)}
                  className="h-8 w-full rounded-sm border border-vscode-border bg-vscode-input px-2 text-[12px] text-vscode-fg outline-none focus:border-vscode-focus"
                />
              </label>
            </div>
          ) : null}
          <label className="block">
            <div className="mb-1 flex justify-between text-[11px] text-vscode-fg-dim">
              <span>ซูม</span>
              <span>{zoom.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-vscode-focus"
            />
          </label>
          <label className="block">
            <div className="mb-1 flex justify-between text-[11px] text-vscode-fg-dim">
              <span>หมุน</span>
              <span>{Math.round(rotation)}°</span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(event) => setRotation(Number(event.target.value))}
              className="w-full accent-vscode-focus"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => quickRotate(-90)}
              className="h-8 rounded-sm border border-vscode-border px-2 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg"
            >
              หมุนซ้าย
            </button>
            <button
              type="button"
              onClick={() => quickRotate(90)}
              className="h-8 rounded-sm border border-vscode-border px-2 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg"
            >
              หมุนขวา
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFlipX((value) => !value)}
              className={`h-8 rounded-sm border px-2 text-[12px] ${
                flipX
                  ? 'border-vscode-focus bg-vscode-list-active text-vscode-fg-bright'
                  : 'border-vscode-border text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
              }`}
            >
              กลับซ้ายขวา
            </button>
            <button
              type="button"
              onClick={() => setFlipY((value) => !value)}
              className={`h-8 rounded-sm border px-2 text-[12px] ${
                flipY
                  ? 'border-vscode-focus bg-vscode-list-active text-vscode-fg-bright'
                  : 'border-vscode-border text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
              }`}
            >
              กลับบนล่าง
            </button>
          </div>
          <button
            type="button"
            onClick={reset}
            className="h-8 w-full rounded-sm border border-vscode-border px-2 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg"
          >
            รีเซ็ต
          </button>
        </aside>
      </div>
    </IdeDialog>
  )
}
