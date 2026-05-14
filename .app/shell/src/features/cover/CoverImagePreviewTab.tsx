import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  HubIdeEditorWatermark,
} from '@shared/ui'
import { ImagePlus, Loader2, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'

export type CoverImagePreviewTabData = {
  rel: string
  name: string
  dataUrl: string | null
  loading: boolean
  error: string | null
}

type Props = {
  tab: CoverImagePreviewTabData
  onUseAsCover: (dataUrl: string) => void
  onUseAsBackground: (dataUrl: string) => void
  onAddAsLayer: (dataUrl: string) => void
}

const ZOOM_MIN = 0.05
const ZOOM_MAX = 32
const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32]

function nextZoomStep(current: number, dir: 1 | -1): number {
  if (dir > 0) {
    for (const step of ZOOM_STEPS) if (step > current + 1e-4) return step
    return ZOOM_MAX
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < current - 1e-4) return ZOOM_STEPS[i]
  }
  return ZOOM_MIN
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function CoverImagePreviewTab({ tab, onUseAsCover, onUseAsBackground, onAddAsLayer }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [fitZoom, setFitZoom] = useState<number>(1)
  const [zoom, setZoom] = useState<number>(1)
  const [autoFit, setAutoFit] = useState<boolean>(true)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const computeFitZoom = useCallback((natW: number, natH: number) => {
    const host = hostRef.current
    if (!host || natW <= 0 || natH <= 0) return 1
    const padding = 32
    const availW = Math.max(64, host.clientWidth - padding)
    const availH = Math.max(64, host.clientHeight - padding)
    return Math.min(availW / natW, availH / natH, 1)
  }, [])

  useEffect(() => {
    if (!naturalSize) return
    const fit = computeFitZoom(naturalSize.w, naturalSize.h)
    setFitZoom(fit)
    if (autoFit) setZoom(fit)
  }, [autoFit, computeFitZoom, naturalSize])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !naturalSize) return
    const ro = new ResizeObserver(() => {
      const fit = computeFitZoom(naturalSize.w, naturalSize.h)
      setFitZoom(fit)
      if (autoFit) setZoom(fit)
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [autoFit, computeFitZoom, naturalSize])

  // Reset pan whenever a new image loads or we re-fit
  useEffect(() => {
    if (autoFit) setPan({ x: 0, y: 0 })
  }, [autoFit, naturalSize, fitZoom])

  const setZoomAtPoint = useCallback(
    (nextZoom: number, anchorClientX?: number, anchorClientY?: number) => {
      const host = hostRef.current
      if (!host || !naturalSize) {
        setAutoFit(false)
        setZoom(clamp(nextZoom, ZOOM_MIN, ZOOM_MAX))
        return
      }
      const z0 = zoom
      const z1 = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX)
      if (Math.abs(z1 - z0) < 1e-4) return
      const rect = host.getBoundingClientRect()
      const cx = anchorClientX ?? rect.left + rect.width / 2
      const cy = anchorClientY ?? rect.top + rect.height / 2
      // Image is positioned at host center + pan offset. Anchor in host coords:
      const ax = cx - rect.left - rect.width / 2 - pan.x
      const ay = cy - rect.top - rect.height / 2 - pan.y
      const ratio = z1 / z0
      const newPanX = pan.x - ax * (ratio - 1)
      const newPanY = pan.y - ay * (ratio - 1)
      setAutoFit(false)
      setZoom(z1)
      setPan({ x: newPanX, y: newPanY })
    },
    [naturalSize, pan.x, pan.y, zoom]
  )

  const onWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const dir = e.deltaY < 0 ? 1 : -1
      const factor = dir > 0 ? 1.15 : 1 / 1.15
      setZoomAtPoint(zoom * factor, e.clientX, e.clientY)
    },
    [setZoomAtPoint, zoom]
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !naturalSize) return
      // Allow pan only when image is bigger than host (or zoomed > fit)
      if (zoom <= fitZoom + 1e-4) return
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
    },
    [fitZoom, naturalSize, pan.x, pan.y, zoom]
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current || !panStartRef.current) return
    const s = panStartRef.current
    setPan({ x: s.px + (e.clientX - s.x), y: s.py + (e.clientY - s.y) })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isPanningRef.current = false
    panStartRef.current = null
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }, [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"]')) return
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoomAtPoint(nextZoomStep(zoom, 1)) }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoomAtPoint(nextZoomStep(zoom, -1)) }
        else if (e.key === '0') { e.preventDefault(); setAutoFit(false); setZoom(1); setPan({ x: 0, y: 0 }) }
        else if (e.key === '9') { e.preventDefault(); setAutoFit(true) }
      }
    },
    [setZoomAtPoint, zoom]
  )

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  const fitToWindow = useCallback(() => { setAutoFit(true); setPan({ x: 0, y: 0 }) }, [])
  const setRealSize = useCallback(() => { setAutoFit(false); setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom])

  if (tab.loading) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center text-vscode-muted">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    )
  }
  if (tab.error || !tab.dataUrl) {
    return (
      <HubIdeEditorWatermark
        title="เปิดไฟล์ภาพไม่สำเร็จ"
        hint={tab.error ?? 'ไฟล์นี้ไม่สามารถแสดงตัวอย่างในเครื่องมือปกได้'}
      />
    )
  }

  const imgW = naturalSize ? naturalSize.w * zoom : undefined
  const imgH = naturalSize ? naturalSize.h * zoom : undefined
  const canPan = !!naturalSize && zoom > fitZoom + 1e-4
  const cursor = canPan ? (isPanningRef.current ? 'grabbing' : 'grab') : 'default'

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-vscode-editor">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-vscode-border bg-vscode-section-header-bg/60 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-vscode-fg">{tab.name}</div>
          <div className="truncate text-[11px] text-vscode-muted">{tab.rel}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" title="ใช้ภาพนี้เป็นปกหลัก" onClick={() => onUseAsCover(tab.dataUrl!)}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-vscode-button px-2.5 text-[12px] text-vscode-fg hover:bg-vscode-button-hover">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            ใช้เป็นปก
          </button>
          <button type="button" title="ใช้ภาพนี้เป็นพื้นหลัง" onClick={() => onUseAsBackground(tab.dataUrl!)}
            className="inline-flex h-8 items-center rounded-sm border border-vscode-border px-2.5 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg">
            ใช้เป็นพื้นหลัง
          </button>
          <button type="button" title="เพิ่มภาพนี้เป็นเลเยอร์บนแคนวาส" onClick={() => onAddAsLayer(tab.dataUrl!)}
            className="inline-flex h-8 items-center rounded-sm border border-vscode-border px-2.5 text-[12px] text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg">
            เพิ่มเป็นเลเยอร์
          </button>
        </div>
      </div>

      {/* Canvas (zoomable / pannable) */}
      <div
        ref={hostRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-vscode-editor select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor }}
        role="img"
        aria-label={tab.name}
      >
        <img
          ref={imgRef}
          src={tab.dataUrl}
          alt={tab.name}
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget
            setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
          }}
          className="block max-w-none"
          style={{
            width: imgW ? `${imgW}px` : undefined,
            height: imgH ? `${imgH}px` : undefined,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            imageRendering: zoom >= 2 ? 'pixelated' : 'auto',
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center gap-2 border-t border-vscode-border bg-vscode-section-header-bg/60 px-2 py-1 text-[11px] text-vscode-muted">
        <button type="button" title="ซูมออก (Ctrl+-)" onClick={() => setZoomAtPoint(nextZoomStep(zoom, -1))}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-vscode-list-hover hover:text-vscode-fg">
          <Minus className="h-3 w-3" aria-hidden />
        </button>
        <button type="button" title="ซูมเข้า (Ctrl++)" onClick={() => setZoomAtPoint(nextZoomStep(zoom, 1))}
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-vscode-list-hover hover:text-vscode-fg">
          <Plus className="h-3 w-3" aria-hidden />
        </button>
        <select
          value={autoFit ? 'fit' : String(zoom)}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'fit') { fitToWindow(); return }
            const next = Number(v)
            if (Number.isFinite(next)) { setAutoFit(false); setZoom(clamp(next, ZOOM_MIN, ZOOM_MAX)); setPan({ x: 0, y: 0 }) }
          }}
          className="h-6 rounded-sm border border-vscode-border bg-vscode-input px-1.5 text-[11px] text-vscode-fg outline-none focus:border-vscode-focus"
          aria-label="ระดับซูม"
        >
          <option value="fit">พอดีหน้าต่าง ({Math.round(fitZoom * 100)}%)</option>
          <option value="0.25">25%</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
          <option value="1.5">150%</option>
          <option value="2">200%</option>
          <option value="4">400%</option>
          <option value="8">800%</option>
          <option value="16">1600%</option>
        </select>
        <button type="button" title="พอดีหน้าต่าง (Ctrl+9)" onClick={fitToWindow}
          className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 hover:bg-vscode-list-hover hover:text-vscode-fg">
          <Maximize2 className="h-3 w-3" aria-hidden />
          พอดี
        </button>
        <button type="button" title="ขนาดจริง 100% (Ctrl+0)" onClick={setRealSize}
          className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 hover:bg-vscode-list-hover hover:text-vscode-fg">
          <RotateCcw className="h-3 w-3" aria-hidden />
          100%
        </button>
        <span className="ml-auto tabular-nums">{zoomPercent}%</span>
        {naturalSize ? (
          <span className="tabular-nums">{naturalSize.w} × {naturalSize.h} px</span>
        ) : null}
      </div>
    </div>
  )
}
