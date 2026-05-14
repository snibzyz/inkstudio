import * as fabric from 'fabric'
import {
  CANVAS_W,
  CANVAS_H,
} from './coverEditorTypes'
import {
  tightenTextboxWidth,
} from './coverEditorUtils'
import { attachSmartGuides } from './useCoverSmartGuides'

type Refs = {
  canvasRef: { current: HTMLCanvasElement | null }
  canvasHostRef: { current: HTMLDivElement | null }
  canvasBoundaryRef: { current: HTMLDivElement | null }
  artboardFrameRef: { current: HTMLDivElement | null }
  fabricRef: { current: fabric.Canvas | null }
  backgroundRectIdRef: { current: string | null }
  numberLayerIdRef: { current: string | null }
  fitCanvasToHostRef: { current: () => void }
  viewZoomPercentRef: { current: number }
  syncAngleFromActiveRef: { current: () => void }
  historyDebounceRef: { current: ReturnType<typeof setTimeout> | null }
  templateBgRefreshTimerRef: { current: ReturnType<typeof setTimeout> | null }
  historyRef: { current: string[] }
  historyIndexRef: { current: number }
}

type Setters = {
  setViewZoomPercent: (n: number) => void
  setHistoryStamp: (updater: (s: number) => number) => void
}

type Hooks = {
  initialBgColor: string
  initialBgMode: 'color' | 'image' | 'transparent'
  initialBgOpacity: number
  syncSelectionFromCanvas: () => void
  syncLayers: () => void
  scheduleHistoryCommit: () => void
}

/**
 * Boots the Fabric canvas with default layers, viewport handlers (Ctrl+wheel zoom, Space+drag pan),
 * smart guides, and ResizeObserver. Returns a cleanup callback.
 */
export function setupCoverCanvas(refs: Refs, setters: Setters, hooks: Hooks): () => void {
  const el = refs.canvasRef.current
  if (!el) return () => {}
  const c = new fabric.Canvas(el, {
    backgroundColor: 'transparent',
    preserveObjectStacking: true,
    selection: true,
    selectionBorderColor: '#007fd4',
    selectionColor: 'rgba(0,127,212,0.12)',
    selectionLineWidth: 1,
  })
  c.setDimensions({ width: CANVAS_W, height: CANVAS_H })

  // VS Code-flavoured per-object selection chrome (corners hug bounds, no extra padding)
  type SelectionDefaults = Pick<fabric.FabricObject, 'borderColor' | 'cornerColor' | 'cornerStrokeColor' | 'cornerStyle' | 'cornerSize' | 'transparentCorners' | 'borderScaleFactor' | 'padding'>
  const ObjProto = (fabric.FabricObject as unknown as { prototype: SelectionDefaults }).prototype
  ObjProto.borderColor = '#007fd4'
  ObjProto.cornerColor = '#ffffff'
  ObjProto.cornerStrokeColor = '#007fd4'
  ObjProto.cornerStyle = 'rect'
  ObjProto.cornerSize = 8
  ObjProto.transparentCorners = false
  ObjProto.borderScaleFactor = 1.2
  ObjProto.padding = 0

  // No system "background rect" — the artboard frame already provides a 16:9 stage,
  // and color/gradient/transparent modes drive `canvas.backgroundColor` directly.
  refs.backgroundRectIdRef.current = null
  c.backgroundColor = hooks.initialBgMode === 'transparent' ? 'transparent' : hooks.initialBgColor

  // Number text is created lazily — only when the user uploads a cover (template mode).
  // Empty starter state should be a clean drop zone, not a stray "001-050" placeholder.
  c.requestRenderAll()

  c.on('selection:created', hooks.syncSelectionFromCanvas)
  c.on('selection:updated', hooks.syncSelectionFromCanvas)
  c.on('selection:cleared', hooks.syncSelectionFromCanvas)
  c.on('object:modified', () => {
    hooks.syncSelectionFromCanvas()
    hooks.syncLayers()
    hooks.scheduleHistoryCommit()
    refs.syncAngleFromActiveRef.current()
  })
  c.on('object:rotating', () => refs.syncAngleFromActiveRef.current())
  c.on('object:added', () => {
    hooks.syncLayers()
    hooks.scheduleHistoryCommit()
  })
  c.on('object:removed', () => {
    hooks.syncLayers()
    hooks.scheduleHistoryCommit()
  })
  c.on('text:changed', (opt) => {
    const t = opt.target as fabric.Object | undefined
    if (t instanceof fabric.Textbox) {
      tightenTextboxWidth(t)
      c.requestRenderAll()
    }
  })
  c.on('mouse:dblclick', (opt) => {
    const target = opt.target as fabric.Object | undefined
    if (!target || (target as unknown as Record<string, unknown>).inkideaLayerKind !== 'text') return
    if (target instanceof fabric.Textbox) {
      target.enterEditing()
      target.selectAll()
      c.requestRenderAll()
    }
  })

  refs.fabricRef.current = c
  hooks.syncLayers()
  refs.historyRef.current = [JSON.stringify({ ...c.toJSON(), width: CANVAS_W, height: CANVAS_H })]
  refs.historyIndexRef.current = 0
  setters.setHistoryStamp((s) => s + 1)

  // Canvas DOM = entire pasteboard (host). The artboard is positioned within the canvas via
  // viewport transform offset (panX, panY in host coords). Object rendering is visually clipped
  // to the artboard rect via a CSS clip-path on the LOWER canvas only — the upper canvas
  // (selection chrome: borders, corner handles, rotation pivot) stays unclipped, so selection
  // handles bleed freely across the whole pasteboard like Photoshop.
  let canvasPanX = 0
  let canvasPanY = 0

  function syncWrapperEl(zoom: number, panX: number, panY: number) {
    canvasPanX = panX
    canvasPanY = panY
    const host = refs.canvasHostRef.current
    const hostW = host ? Math.max(host.clientWidth, 100) : 100
    const hostH = host ? Math.max(host.clientHeight, 100) : 100
    const wrapperEl = refs.canvasBoundaryRef.current
    if (wrapperEl) {
      wrapperEl.style.left = '0px'
      wrapperEl.style.top = '0px'
      wrapperEl.style.width = `${hostW}px`
      wrapperEl.style.height = `${hostH}px`
    }
    const frameEl = refs.artboardFrameRef.current
    if (frameEl) {
      frameEl.style.left = `${panX}px`
      frameEl.style.top = `${panY}px`
      frameEl.style.width = `${CANVAS_W * zoom}px`
      frameEl.style.height = `${CANVAS_H * zoom}px`
    }
    const fc = refs.fabricRef.current
    if (fc) {
      const lower = (fc as fabric.Canvas & { lowerCanvasEl?: HTMLCanvasElement }).lowerCanvasEl
      if (lower) {
        const artW = CANVAS_W * zoom
        const artH = CANVAS_H * zoom
        const insetTop = Math.max(0, panY)
        const insetLeft = Math.max(0, panX)
        const insetRight = Math.max(0, hostW - panX - artW)
        const insetBottom = Math.max(0, hostH - panY - artH)
        lower.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`
      }
    }
  }

  refs.fitCanvasToHostRef.current = () => {
    const c2 = refs.fabricRef.current
    const h = refs.canvasHostRef.current
    if (!c2 || !h) return
    const hostW = Math.max(h.clientWidth, 100)
    const hostH = Math.max(h.clientHeight, 100)
    const fitScale = Math.min(hostW / CANVAS_W, hostH / CANVAS_H)
    const zoom = Math.max(fitScale * (refs.viewZoomPercentRef.current / 100), 0.01)
    const panX = Math.round((hostW - CANVAS_W * zoom) / 2)
    const panY = Math.round((hostH - CANVAS_H * zoom) / 2)
    c2.setDimensions({ width: hostW, height: hostH })
    c2.setViewportTransform([zoom, 0, 0, zoom, panX, panY])
    syncWrapperEl(zoom, panX, panY)
    c2.requestRenderAll()
  }

  let ro: ResizeObserver | null = null
  const host = refs.canvasHostRef.current

  let zoomCursorTimer: ReturnType<typeof setTimeout> | null = null

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const fc = refs.fabricRef.current
    const h = refs.canvasHostRef.current
    if (!fc || !h) return
    const oldZoom = fc.getZoom()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const hostRect = h.getBoundingClientRect()
    const hostW = Math.max(h.clientWidth, 100)
    const hostH = Math.max(h.clientHeight, 100)
    const fitScale = Math.min(hostW / CANVAS_W, hostH / CANVAS_H)
    const newZoom = Math.max(fitScale * 0.1, Math.min(fitScale * 20, oldZoom * factor))
    // Cursor in host coords
    const mx = e.clientX - hostRect.left
    const my = e.clientY - hostRect.top
    // Logical artboard coord under cursor
    const logicalX = (mx - canvasPanX) / oldZoom
    const logicalY = (my - canvasPanY) / oldZoom
    // New pan that keeps that logical point fixed under cursor
    const newPanX = Math.round(mx - logicalX * newZoom)
    const newPanY = Math.round(my - logicalY * newZoom)
    fc.setDimensions({ width: hostW, height: hostH })
    fc.setViewportTransform([newZoom, 0, 0, newZoom, newPanX, newPanY])
    syncWrapperEl(newZoom, newPanX, newPanY)
    const newPercent = Math.min(400, Math.max(10, Math.round((newZoom / fitScale) * 100)))
    refs.viewZoomPercentRef.current = newPercent
    setters.setViewZoomPercent(newPercent)
    fc.requestRenderAll()

    // Flash zoom-in/zoom-out cursor briefly to show zoom direction
    if (host && !panning && !spaceDown && !handToolMode) {
      const dirCursor = e.deltaY > 0 ? 'zoom-out' : 'zoom-in'
      setFabricCursor(dirCursor)
      host.style.cursor = dirCursor
      if (zoomCursorTimer) clearTimeout(zoomCursorTimer)
      zoomCursorTimer = setTimeout(() => {
        zoomCursorTimer = null
        refreshCursor()
      }, 350)
    }
  }
  host?.addEventListener('wheel', onWheel, { passive: false })

  let spaceDown = false
  let panning = false
  let handToolMode = false      // H key persistent hand tool
  let altDown = false           // modifier — for Alt+drag duplicate + copy cursor
  let ctrlDown = false          // modifier — for zoom-in cursor while held
  let panAnchor = { x: 0, y: 0 }

  // Alt+drag duplicate state
  // กลยุทธ์: pre-clone active object เก็บไว้ใน cache → ตอน Alt+drag เริ่มขยับ
  // → ใส่ clone ทับตำแหน่งเริ่มต้นของ object ใต้ stack → original ลากต่อไป
  let altCloneCache: fabric.Object | null = null
  let altDuplicatePending = false
  let altDuplicateActivated = false
  let altDuplicateStartLeft = 0
  let altDuplicateStartTop = 0

  // ─── Cursor management (Photoshop convention) ──────────────────────────
  // Priority (สูง → ต่ำ):
  //   1. panning              → 'grabbing'
  //   2. spaceDown/handTool   → 'grab'
  //   3. altDown + active obj → 'copy'   (จะ duplicate ถ้าลาก)
  //   4. ctrlDown             → 'zoom-in' (กำลังจะ zoom เมื่อ scroll)
  //   5. (default)            → คืน Fabric originals (move บน object, default บน pasteboard)
  //
  // Fabric ทับ host.style.cursor ด้วย hoverCursor ของแต่ละ object —
  // ต้องตั้ง Fabric's defaultCursor/hoverCursor/moveCursor พร้อมกัน
  // และ document.body.style.cursor ตอน drag กันไม่ให้ revert ถ้าออกนอก host

  const originalCursors = {
    defaultCursor: c.defaultCursor,
    hoverCursor: c.hoverCursor,
    moveCursor: c.moveCursor,
  }

  function setFabricCursor(cursor: string) {
    c.defaultCursor = cursor
    c.hoverCursor = cursor
    c.moveCursor = cursor
  }

  function restoreFabricCursors() {
    c.defaultCursor = originalCursors.defaultCursor
    c.hoverCursor = originalCursors.hoverCursor
    c.moveCursor = originalCursors.moveCursor
  }

  function refreshCursor() {
    let cursor = ''
    if (panning) cursor = 'grabbing'
    else if (spaceDown || handToolMode) cursor = 'grab'
    else if (altDown && c.getActiveObject() && (c.getActiveObject() as unknown as Record<string, unknown>).inkideaLayerKind !== 'background' && altCloneCache) cursor = 'copy'
    else if (ctrlDown) cursor = 'zoom-in'

    if (cursor) {
      setFabricCursor(cursor)
      if (host) host.style.cursor = cursor
    } else {
      restoreFabricCursors()
      if (host) host.style.cursor = ''
    }
  }

  function enterPanMode() {
    c.selection = false
    c.getObjects().forEach((o) => {
      if ((o as unknown as Record<string, unknown>).inkideaLayerKind !== 'background') o.selectable = false
    })
    refreshCursor()
  }

  function exitPanMode() {
    c.selection = true
    c.getObjects().forEach((o) => {
      if ((o as unknown as Record<string, unknown>).inkideaLayerKind !== 'background') o.selectable = true
    })
    refreshCursor()
  }

  // ─── Alt clone cache — rebuild whenever selection changes ──────────────
  async function rebuildAltCloneCache() {
    altCloneCache = null
    const active = c.getActiveObject()
    if (!active) return
    if ((active as unknown as Record<string, unknown>).inkideaLayerKind === 'background') return
    try {
      const clone = (await active.clone()) as fabric.Object
      const newIdStr = (typeof crypto !== 'undefined' && (crypto as { randomUUID?: () => string }).randomUUID?.()) ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      ;(clone as unknown as Record<string, unknown>).inkideaLayerId = newIdStr
      const oldLabel = String((active as unknown as Record<string, unknown>).inkideaLayerLabel ?? 'เลเยอร์')
      ;(clone as unknown as Record<string, unknown>).inkideaLayerLabel = `${oldLabel} (สำเนา)`
      altCloneCache = clone
      if (altDown) refreshCursor()
    } catch {
      altCloneCache = null
    }
  }

  c.on('selection:created', () => { void rebuildAltCloneCache() })
  c.on('selection:updated', () => { void rebuildAltCloneCache() })
  c.on('selection:cleared', () => {
    altCloneCache = null
    if (altDown) refreshCursor()
  })
  c.on('object:modified', () => { void rebuildAltCloneCache() })

  // ─── Alt+drag duplicate handlers ───────────────────────────────────────
  c.on('mouse:down', (opt) => {
    altDuplicatePending = false
    altDuplicateActivated = false
    if (!altDown || spaceDown || handToolMode) return
    const tgt = opt.target as fabric.Object | undefined
    if (!tgt) return
    if ((tgt as unknown as Record<string, unknown>).inkideaLayerKind === 'background') return
    if (!altCloneCache) return // cache ยังไม่พร้อม → ไม่ duplicate
    altDuplicatePending = true
    altDuplicateStartLeft = tgt.left ?? 0
    altDuplicateStartTop = tgt.top ?? 0
  })

  c.on('object:moving', (opt) => {
    if (!altDuplicatePending || altDuplicateActivated) return
    if (!altCloneCache) return
    const moving = opt.target as fabric.Object | undefined
    if (!moving) return
    altDuplicateActivated = true
    altCloneCache.set({
      left: altDuplicateStartLeft,
      top: altDuplicateStartTop,
      angle: moving.angle ?? 0,
      scaleX: moving.scaleX ?? 1,
      scaleY: moving.scaleY ?? 1,
      flipX: moving.flipX ?? false,
      flipY: moving.flipY ?? false,
    })
    altCloneCache.setCoords()
    c.add(altCloneCache)
    // วาง clone ใต้ original ใน stack — original อยู่บนสุดของ pair
    const stack = (c as unknown as { _objects: fabric.Object[] })._objects
    const tgtIdx = stack.indexOf(moving)
    const cloneIdx = stack.indexOf(altCloneCache)
    if (cloneIdx > tgtIdx && tgtIdx !== -1) {
      stack.splice(cloneIdx, 1)
      stack.splice(tgtIdx, 0, altCloneCache)
    }
    hooks.syncLayers()
    altCloneCache = null
    void rebuildAltCloneCache()
  })

  c.on('mouse:up', () => {
    if (altDuplicateActivated) {
      altDuplicatePending = false
      altDuplicateActivated = false
      hooks.scheduleHistoryCommit()
    }
  })

  // ─── Keyboard ───────────────────────────────────────────────────────────
  const onSpaceDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat) return
    const t = e.target as Element
    if (t.closest('input,textarea,select,[contenteditable]')) return
    spaceDown = true
    enterPanMode()
  }
  const onSpaceUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space') return
    spaceDown = false
    panning = false
    if (!handToolMode) exitPanMode()
    else refreshCursor()
    document.body.style.cursor = ''
  }

  // H key = toggle persistent hand tool (PS convention)
  // V key = exit hand tool (Move/Select tool)
  const onToolKey = (e: KeyboardEvent) => {
    if (e.repeat) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    const t = e.target as Element
    if (t.closest('input,textarea,select,[contenteditable]')) return
    if (e.code === 'KeyH') {
      e.preventDefault()
      handToolMode = !handToolMode
      if (handToolMode) enterPanMode()
      else if (!spaceDown) exitPanMode()
    } else if (e.code === 'KeyV') {
      if (handToolMode) {
        e.preventDefault()
        handToolMode = false
        if (!spaceDown) exitPanMode()
      }
    } else if (e.code === 'Escape') {
      // Bonus: Esc ก็ออก hand tool ได้ด้วย
      if (handToolMode) {
        handToolMode = false
        if (!spaceDown) exitPanMode()
      }
    }
  }

  // Modifier-key cursor tracking (Alt, Ctrl)
  const onModKey = (e: KeyboardEvent) => {
    // อ่าน state ปัจจุบันจาก event flags — รองรับการสลับ key หลายตัว
    const newAlt = e.altKey
    const newCtrl = e.ctrlKey || e.metaKey
    if (newAlt === altDown && newCtrl === ctrlDown) return
    altDown = newAlt
    ctrlDown = newCtrl
    refreshCursor()
  }

  // middle-mouse-button drag = pan (PS convention) — ไม่ต้องกด Space
  const onPanDown = (e: MouseEvent) => {
    const isMiddle = e.button === 1
    if (!spaceDown && !handToolMode && !isMiddle) return
    panning = true
    panAnchor = { x: e.clientX, y: e.clientY }
    refreshCursor()
    document.body.style.cursor = 'grabbing'
    e.preventDefault()
  }

  // ป้องกัน browser auto-scroll mode ที่เปิดด้วย middle-click บางระบบ
  const onAuxClick = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }
  host?.addEventListener('auxclick', onAuxClick)
  const onPanMove = (e: MouseEvent) => {
    if (!panning) return
    const dx = e.clientX - panAnchor.x
    const dy = e.clientY - panAnchor.y
    panAnchor = { x: e.clientX, y: e.clientY }
    const fc = refs.fabricRef.current
    if (!fc) return
    const zoom = fc.getZoom()
    const newPanX = canvasPanX + dx
    const newPanY = canvasPanY + dy
    fc.setViewportTransform([zoom, 0, 0, zoom, newPanX, newPanY])
    syncWrapperEl(zoom, newPanX, newPanY)
    fc.requestRenderAll()
  }
  const onPanUp = () => {
    if (!panning) return
    panning = false
    document.body.style.cursor = ''
    refreshCursor()
  }

  // ─── Blur safety — ถ้า window blur ระหว่าง modifier ค้าง (alt-tab) → reset
  // ป้องกัน cursor ค้างเป็น grab/grabbing/copy เพราะ keyup event หาย
  const onWindowBlur = () => {
    const wasActive = spaceDown || panning || altDown || ctrlDown
    spaceDown = false
    panning = false
    altDown = false
    ctrlDown = false
    altDuplicatePending = false
    altDuplicateActivated = false
    if (wasActive) {
      if (!handToolMode) exitPanMode()
      else refreshCursor()
      document.body.style.cursor = ''
    }
  }
  window.addEventListener('blur', onWindowBlur)

  window.addEventListener('keydown', onSpaceDown)
  window.addEventListener('keyup', onSpaceUp)
  window.addEventListener('keydown', onToolKey)
  window.addEventListener('keydown', onModKey)
  window.addEventListener('keyup', onModKey)
  host?.addEventListener('mousedown', onPanDown)
  window.addEventListener('mousemove', onPanMove)
  window.addEventListener('mouseup', onPanUp)

  if (host) {
    ro = new ResizeObserver(() => refs.fitCanvasToHostRef.current())
    ro.observe(host)
  }
  const detachGuides = attachSmartGuides(c)
  queueMicrotask(() => refs.fitCanvasToHostRef.current())

  return () => {
    ro?.disconnect()
    detachGuides()
    host?.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onSpaceDown)
    window.removeEventListener('keyup', onSpaceUp)
    window.removeEventListener('keydown', onToolKey)
    window.removeEventListener('keydown', onModKey)
    window.removeEventListener('keyup', onModKey)
    host?.removeEventListener('mousedown', onPanDown)
    host?.removeEventListener('auxclick', onAuxClick)
    window.removeEventListener('mousemove', onPanMove)
    window.removeEventListener('mouseup', onPanUp)
    window.removeEventListener('blur', onWindowBlur)
    if (zoomCursorTimer) { clearTimeout(zoomCursorTimer); zoomCursorTimer = null }
    document.body.style.cursor = ''
    if (refs.historyDebounceRef.current) {
      clearTimeout(refs.historyDebounceRef.current)
      refs.historyDebounceRef.current = null
    }
    if (refs.templateBgRefreshTimerRef.current) {
      clearTimeout(refs.templateBgRefreshTimerRef.current)
      refs.templateBgRefreshTimerRef.current = null
    }
    refs.fabricRef.current = null
    c.dispose()
  }
}
