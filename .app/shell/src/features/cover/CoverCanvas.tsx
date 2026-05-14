import { useCallback, useState } from 'react'
import { cn, zoneCanvasShell, zonePasteboard } from '@shared/ui'
import { ArrowDown, ArrowUp, ImagePlus, Move, Redo2, RotateCcw, Undo2 } from 'lucide-react'
import { useCoverEditorCtx } from './CoverEditorContext'
import { CANVAS_H, CANVAS_W, type InkLayerKind } from './coverEditorTypes'
import { readBrowserFileAsDataUrl } from './coverEditorUtils'

function ToolBtn({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-[5px] text-[12px] text-vscode-fg-dim transition-colors hover:bg-vscode-list-hover hover:text-vscode-fg disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

function ToolDivider() {
  return <span className="mx-1 h-4 w-px bg-vscode-border" aria-hidden />
}

export function CoverCanvas() {
  const {
    programActive,
    busy,
    canvasRef,
    canvasHostRef,
    canvasBoundaryRef,
    artboardFrameRef,
    layers,
    selectedLayerId,
    canHistoryUndo,
    canHistoryRedo,
    viewZoomPercent, setViewZoomPercent,
    undoCanvas,
    redoCanvas,
    freeTransformActive,
    bringForwardSelected,
    sendBackwardSelected,
    resetView,
    loadTemplateCoverImageFromDataUrl,
    loadTemplateCustomBackground,
    openCoverCropDialog,
  } = useCoverEditorCtx()

  const [dragHover, setDragHover] = useState(false)

  // "Empty" = the user hasn't added a cover image, custom BG, or any non-template layer yet.
  // Excludes the always-present background rect + initial Number text placeholder.
  const isEmpty = !layers.some((l) => {
    const k = l.kind as InkLayerKind
    if (k === 'image') return true
    if (k === 'background' && l.label !== 'พื้นหลัง') return true
    return false
  })

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragHover(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await readBrowserFileAsDataUrl(file)
      const useAsBackground = e.shiftKey
      if (useAsBackground) {
        openCoverCropDialog('background', dataUrl, loadTemplateCustomBackground)
      } else {
        const original = dataUrl
        openCoverCropDialog('cover', dataUrl, async (croppedUrl) => {
          await loadTemplateCoverImageFromDataUrl(croppedUrl, original)
        })
      }
    } catch {
      // ignore — file read failures are reported via the picker flow normally
    }
  }, [loadTemplateCoverImageFromDataUrl, loadTemplateCustomBackground, openCoverCropDialog])

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`แคนวาสปก ${CANVAS_W}×${CANVAS_H}`}>
      {/* Toolbar */}
      <div className={`flex shrink-0 flex-wrap items-center gap-0.5 border-b border-vscode-border px-2 py-1 ${zoneCanvasShell}`}>
        {programActive ? (
          <>
            <ToolBtn title="เลิกทำ (Ctrl+Z)" disabled={busy || !canHistoryUndo} onClick={() => void undoCanvas()}>
              <Undo2 className="h-[14px] w-[14px]" />
              เลิกทำ
            </ToolBtn>
            <ToolBtn title="ทำซ้ำ (Ctrl+Shift+Z)" disabled={busy || !canHistoryRedo} onClick={() => void redoCanvas()}>
              <Redo2 className="h-[14px] w-[14px]" />
              ทำซ้ำ
            </ToolBtn>
            <ToolDivider />
            <ToolBtn title="Free Transform (Ctrl+T)" disabled={busy || !selectedLayerId} onClick={freeTransformActive}>
              <Move className="h-[14px] w-[14px]" />
              ปรับแปลง
            </ToolBtn>
            <ToolDivider />
            <ToolBtn title="เลเยอร์ขึ้นหน้า (Ctrl+])" disabled={busy || !selectedLayerId} onClick={bringForwardSelected}>
              <ArrowUp className="h-[14px] w-[14px]" />
              ขึ้น
            </ToolBtn>
            <ToolBtn title="เลเยอร์ลงหลัง (Ctrl+[)" disabled={busy || !selectedLayerId} onClick={sendBackwardSelected}>
              <ArrowDown className="h-[14px] w-[14px]" />
              ลง
            </ToolBtn>
            <ToolDivider />
          </>
        ) : null}

        <div className="flex min-w-0 max-w-[180px] flex-1 items-center gap-2">
          <span className="shrink-0 tabular-nums text-[11px] text-vscode-muted">{viewZoomPercent}%</span>
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={viewZoomPercent}
            onChange={(e) => setViewZoomPercent(Number(e.target.value))}
            disabled={busy}
            className="w-full min-w-[60px] accent-vscode-focus"
            title={`ย่อ/ขยายบนหน้าจอ — ไฟล์จริง ${CANVAS_W}×${CANVAS_H}\nCtrl+scroll = ซูมที่ตำแหน่งเมาส์ · Space+ลาก = pan\nCtrl+0 = พอดีหน้า · Ctrl+1 = ขนาดจริง 100% · Ctrl+± = ซูม±10%`}
          />
        </div>

        <ToolBtn title="รีเซ็ตมุมมอง" disabled={busy} onClick={resetView}>
          <RotateCcw className="h-[14px] w-[14px]" />
        </ToolBtn>
      </div>

      {/* Pasteboard — outer div is the ResizeObserver target; the artboard wrapper holds fabric canvas
          at exact 16:9 (1280×720) scaled, so anything past artboard is clipped naturally. */}
      <div
        ref={canvasHostRef}
        className={cn(
          'relative min-h-0 w-full min-w-0 flex-1 overflow-hidden',
          zonePasteboard,
          dragHover ? 'ring-2 ring-inset ring-vscode-focus' : ''
        )}
        aria-label="พื้นที่แคนวาส"
        onDragOver={(e) => { e.preventDefault(); setDragHover(true) }}
        onDragEnter={(e) => { e.preventDefault(); setDragHover(true) }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setDragHover(false)
        }}
        onDrop={handleDrop}
      >
        {/* Canvas wrapper — fills the entire pasteboard. Object rendering on the lower canvas is
            visually clipped to the artboard rect via a CSS clip-path (set in setupCoverCanvas);
            the upper canvas (selection chrome) is unclipped, so selection handles bleed across
            the whole pasteboard like Photoshop. */}
        <div ref={canvasBoundaryRef} className="absolute">
          <canvas ref={canvasRef} className="block" />
        </div>
        {/* Artboard 16:9 frame — sits ABOVE the canvas (pointer-events-none so it doesn't steal
            clicks). Holds the empty-state overlay so it always tracks the artboard rect, and
            paints the box-shadow that visually marks the YouTube cover. */}
        <div
          ref={artboardFrameRef}
          className="pointer-events-none absolute overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 40px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.6)' }}
        >
          {isEmpty || dragHover ? (
            <div
              className={cn(
                'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-vscode-fg-dim',
                dragHover ? 'bg-vscode-focus/10' : 'bg-black/35'
              )}
            >
              <ImagePlus className="h-8 w-8 opacity-70" aria-hidden />
              <div className="text-center text-[13px] leading-snug">
                <div className="font-medium">{dragHover ? 'วางที่นี่เพื่อใช้เป็นปก' : 'ลากภาพปกมาวางที่นี่'}</div>
                <div className="mt-0.5 text-[11px] text-vscode-muted">
                  {dragHover ? 'กด Shift ค้างไว้เพื่อใช้เป็นพื้นหลังแทน' : 'หรือกด "อัปปก" ที่แผงด้านขวา · Shift+ลาก = พื้นหลัง'}
                </div>
                {!dragHover ? (
                  <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] tabular-nums text-vscode-muted/80">
                    <span><kbd className="rounded-sm border border-vscode-border/60 px-1">Space</kbd>+ลาก = pan</span>
                    <span><kbd className="rounded-sm border border-vscode-border/60 px-1">Ctrl</kbd>+scroll = ซูม</span>
                    <span><kbd className="rounded-sm border border-vscode-border/60 px-1">Ctrl+0</kbd> = พอดีหน้า</span>
                    <span><kbd className="rounded-sm border border-vscode-border/60 px-1">Ctrl+1</kbd> = 100%</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

    </main>
  )
}
