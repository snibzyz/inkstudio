import { useEffect, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { useHubWorkspace } from '@/state/useHubWorkspace'
import {
  INK_SERIALIZE_PROPS,
  CANVAS_W,
  CANVAS_H,
  type InkLayer,
  type InkLayerKind,
} from './coverEditorTypes'
import {
  newId,
  clamp,
  stampInkideaTransformDefaults,
  ensureInkideaTransformDefaults,
  textObjectGradientForTextbox,
  tightenTextboxWidth,
  formatLoadError,
  getFabricObjectById,
  reorderFabricObjectStep,
  canvasBgGradient,
  hexToRgba,
  pickImageSourceAsync,
  imageSourceToDataUrlAsync,
  createFabricImageFromDataUrl,
  reapplyAdjustmentsForCanvas,
} from './coverEditorUtils'
import { useCoverEditorBgTemplate } from './useCoverEditorBgTemplate'
import { useCoverEditorExport } from './useCoverEditorExport'
import { useCoverLayerAdjustments } from './useCoverLayerAdjustments'
import { setupCoverCanvas } from './setupCoverCanvas'

// Register custom serialization properties once per module load
{
  const base = fabric.FabricObject.customProperties ?? []
  fabric.FabricObject.customProperties = [...new Set([...base, ...INK_SERIALIZE_PROPS])]
}

export function useCoverEditor(programActive: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const electron = (window as any).electron?.ipc
  const workspaceRoot = useHubWorkspace((s) => s.workspaceRoot)
  const activeProject = useHubWorkspace((s) => s.activeProject)
  const getActiveProjectRelRoot = useHubWorkspace((s) => s.getActiveProjectRelRoot)
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const canvasBoundaryRef = useRef<HTMLDivElement | null>(null)
  const artboardFrameRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagePickerRef = useRef<HTMLInputElement | null>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  const [layers, setLayers] = useState<InkLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const selectedLayerIdRef = useRef<string | null>(null)
  selectedLayerIdRef.current = selectedLayerId

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [bgMode, setBgMode] = useState<'color' | 'image' | 'transparent'>('color')
  const [bgColor, setBgColor] = useState<string>('#1e1e1e')
  const [bgOpacity, setBgOpacity] = useState<number>(1)
  const [bgFillStyle, setBgFillStyle] = useState<'solid' | 'gradient'>('solid')
  const [bgGradientFrom, setBgGradientFrom] = useState<string>('#0f172a')
  const [bgGradientTo, setBgGradientTo] = useState<string>('#334155')
  const [bgGradientDirection, setBgGradientDirection] = useState<'vertical' | 'horizontal'>('vertical')
  const backgroundRectIdRef = useRef<string | null>(null)
  const backgroundImageIdRef = useRef<string | null>(null)
  const numberLayerIdRef = useRef<string | null>(null)

  const selectedObject = useMemo(() => {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return null
    return (c.getObjects().find((o: any) => (o as any).inkideaLayerId === selectedLayerId) ?? null) as
      | (fabric.Object & { inkideaLayerKind?: InkLayerKind })
      | null
  }, [selectedLayerId, layers])

  const [textValue, setTextValue] = useState<string>('')
  const [textFontSize, setTextFontSize] = useState<number>(64)
  const [textFontFamily, setTextFontFamily] = useState<string>(() =>
    localStorage.getItem('inkidea-cover-last-font') || 'Tahoma'
  )
  const [textFill, setTextFill] = useState<string>('#ffffff')
  const [textOpacity, setTextOpacity] = useState<number>(1)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center')
  const [strokeEnabled, setStrokeEnabled] = useState<boolean>(false)
  const [strokeWidth, setStrokeWidth] = useState<number>(3)
  const [strokeColor, setStrokeColor] = useState<string>('#000000')
  const [textStrokeAlign, setTextStrokeAlign] = useState<'outside' | 'inside'>('outside')
  const [fillMode, setFillMode] = useState<'solid' | 'gradient'>('solid')
  const [gradientFrom, setGradientFrom] = useState<string>('#34d399')
  const [gradientTo, setGradientTo] = useState<string>('#60a5fa')
  const [gradientDirection, setGradientDirection] = useState<'vertical' | 'horizontal'>('vertical')
  const [imageOpacity, setImageOpacity] = useState<number>(1)
  const [shapeFill, setShapeFill] = useState<string>('#f59e0b')
  const [shapeStroke, setShapeStroke] = useState<string>('#0f172a')
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2)
  const [shapeOpacity, setShapeOpacity] = useState<number>(1)
  const [layerAngleDeg, setLayerAngleDeg] = useState(0)
  const [viewZoomPercent, setViewZoomPercent] = useState<number>(100)
  const viewZoomPercentRef = useRef(100)
  viewZoomPercentRef.current = viewZoomPercent
  const fitCanvasToHostRef = useRef<() => void>(() => {})

  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(0)
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isApplyingHistoryRef = useRef(false)
  const historyMuteRef = useRef(false)
  const [historyStamp, setHistoryStamp] = useState(0)
  const shortcutRef = useRef({ undo: () => Promise.resolve(), redo: () => Promise.resolve(), ft: () => {} })
  const syncAngleFromActiveRef = useRef(() => {})

  // ---------------------------------------------------------------------------
  // Sub-hooks
  // ---------------------------------------------------------------------------

  const tmpl = useCoverEditorBgTemplate({
    fabricRef, backgroundImageIdRef, numberLayerIdRef, imagePickerRef,
    electron, syncLayers, setError, setSelectedLayerId,
    bgMode, setBgMode,
  })

  const defaultExportFolder = useMemo(() => {
    if (!workspaceRoot) return ''
    const projectRel = getActiveProjectRelRoot()
    const coversRel = ((activeProject?.paths as any)?.media?.covers as string | undefined) ?? 'Cover'
    const parts = [workspaceRoot, projectRel, coversRel].filter(Boolean)
    const sep = workspaceRoot.includes('\\') ? '\\' : '/'
    return parts.join(sep)
  }, [workspaceRoot, activeProject, getActiveProjectRelRoot])

  const projectStorageKey = activeProject?.id ? `inkidea-cover-export-${activeProject.id}` : ''

  const exportHook = useCoverEditorExport({ fabricRef, numberLayerIdRef, electron, setBusy, setError, defaultExportFolder, projectStorageKey })

  const adjustmentsHook = useCoverLayerAdjustments({
    fabricRef,
    selectedObject,
    selectedLayerId,
    scheduleHistoryCommit: () => scheduleHistoryCommit(),
  })

  // ---------------------------------------------------------------------------
  // Canvas utility functions
  // ---------------------------------------------------------------------------

  syncAngleFromActiveRef.current = () => {
    const c = fabricRef.current
    const id = selectedLayerIdRef.current
    if (!c || !id) return
    const act = c.getActiveObject()
    if (!act || (act as any).inkideaLayerId !== id) return
    setLayerAngleDeg(Math.round(act.angle ?? 0))
  }

  function rebuildRefsFromCanvas(c: fabric.Canvas) {
    backgroundRectIdRef.current = null
    backgroundImageIdRef.current = null
    numberLayerIdRef.current = null
    tmpl.templateCoverIdRef.current = null
    tmpl.templateTitleIdRef.current = null
    tmpl.templateCreditIdRef.current = null
    for (const o of c.getObjects()) {
      const id = String((o as any).inkideaLayerId ?? '')
      if (!id) continue
      const kind = (o as any).inkideaLayerKind as InkLayerKind
      const label = String((o as any).inkideaLayerLabel ?? '')
      if (kind === 'background') {
        if (o instanceof fabric.Rect && label === 'พื้นหลัง') backgroundRectIdRef.current = id
        else if (o instanceof fabric.Image) backgroundImageIdRef.current = id
      }
      if (label === 'Number') numberLayerIdRef.current = id
      if (label === 'ชื่อเรื่อง') tmpl.templateTitleIdRef.current = id
      if (label === 'ภาพปก 3:4') tmpl.templateCoverIdRef.current = id
      if (label.startsWith('เครดิต')) tmpl.templateCreditIdRef.current = id
    }
  }

  async function applyCanvasFromHistorySnapshot(jsonStr: string) {
    const c = fabricRef.current
    if (!c) return
    historyMuteRef.current = true
    if (historyDebounceRef.current) { clearTimeout(historyDebounceRef.current); historyDebounceRef.current = null }
    isApplyingHistoryRef.current = true
    try {
      const parsed = JSON.parse(jsonStr) as object
      await c.loadFromJSON(parsed)
      // Restore canvas to current host dimensions then re-fit viewport
      const hostEl = canvasHostRef.current
      if (hostEl) c.setDimensions({ width: Math.max(hostEl.clientWidth, 100), height: Math.max(hostEl.clientHeight, 100) })
      c.set({ backgroundColor: 'transparent' })
      rebuildRefsFromCanvas(c)
      for (const o of c.getObjects()) ensureInkideaTransformDefaults(o)
      reapplyAdjustmentsForCanvas(c)
      c.discardActiveObject()
      syncLayers()
      setSelectedLayerId(null)
      queueMicrotask(() => fitCanvasToHostRef.current())
    } finally {
      isApplyingHistoryRef.current = false
      setTimeout(() => { historyMuteRef.current = false }, 400)
    }
  }

  // ---------------------------------------------------------------------------
  // Cover template save/load (per-project JSON, shareable across users)
  // ---------------------------------------------------------------------------

  const COVER_TEMPLATE_FILENAME = 'cover-template.json'

  function buildProjectTemplateRelPath(): string | null {
    const projectRel = getActiveProjectRelRoot()
    if (!projectRel) return null
    const coversRel = ((activeProject?.paths as { media?: { covers?: string } } | undefined)?.media?.covers) ?? 'Cover'
    const sep = projectRel.includes('\\') ? '\\' : '/'
    return [projectRel, coversRel, COVER_TEMPLATE_FILENAME].filter(Boolean).join(sep)
  }

  async function saveCoverTemplate() {
    setError(null)
    const c = fabricRef.current
    if (!c) return
    if (!electron?.hubWriteWorkspaceTextFile) {
      setError('บันทึกเทมเพลตได้เฉพาะใน Electron')
      return
    }
    const relPath = buildProjectTemplateRelPath()
    if (!relPath) {
      setError('ยังไม่ได้เลือกโปรเจกต์')
      return
    }
    setBusy(true)
    try {
      const doc = {
        version: 1,
        kind: 'inkidea-cover-template',
        createdAt: new Date().toISOString(),
        settings: {
          templateFontChoice: tmpl.templateFontChoice,
          templateApplyDefaults: tmpl.templateApplyDefaults,
          templateCreditVisible: tmpl.templateCreditVisible,
          templateTitle: tmpl.templateTitle,
          templateEpisode: tmpl.templateEpisode,
          bgMode, bgColor, bgOpacity, bgFillStyle,
          bgGradientFrom, bgGradientTo, bgGradientDirection,
        },
        canvas: { ...c.toJSON(), width: CANVAS_W, height: CANVAS_H },
      }
      await electron.hubWriteWorkspaceTextFile({ relPath, content: JSON.stringify(doc, null, 2) })
      const sizeKb = Math.round(JSON.stringify(doc).length / 1024)
      setError(`✓ บันทึกเทมเพลตที่ ${relPath} (${sizeKb} KB)`)
    } catch (e) {
      setError(`บันทึกเทมเพลตไม่สำเร็จ: ${formatLoadError(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function revealCoverTemplateFolder() {
    setError(null)
    if (!electron?.hubOpenInExplorerWorkspaceRel) return
    const projectRel = getActiveProjectRelRoot()
    if (!projectRel) {
      setError('ยังไม่ได้เลือกโปรเจกต์')
      return
    }
    const coversRel = ((activeProject?.paths as { media?: { covers?: string } } | undefined)?.media?.covers) ?? 'Cover'
    const sep = projectRel.includes('\\') ? '\\' : '/'
    const relPath = [projectRel, coversRel].filter(Boolean).join(sep)
    try {
      await electron.hubOpenInExplorerWorkspaceRel({ relPath })
    } catch (e) {
      setError(`เปิดโฟลเดอร์ไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  function decodeDataUrlAsUtf8Text(dataUrl: string): string {
    const base64 = dataUrl.split(',')[1] ?? ''
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  }

  async function applyCoverTemplateDoc(text: string) {
    const doc = JSON.parse(text) as {
      kind?: string
      settings?: Record<string, unknown>
      canvas?: object
    }
    if (doc?.kind !== 'inkidea-cover-template') {
      throw new Error('ไฟล์นี้ไม่ใช่เทมเพลตปก')
    }
    const s = doc.settings ?? {}
    if (typeof s.templateFontChoice === 'string') tmpl.setTemplateFontChoice(s.templateFontChoice)
    if (typeof s.templateApplyDefaults === 'boolean') tmpl.setTemplateApplyDefaults(s.templateApplyDefaults)
    if (typeof s.templateCreditVisible === 'boolean') tmpl.setTemplateCreditVisible(s.templateCreditVisible)
    if (typeof s.templateTitle === 'string') tmpl.setTemplateTitle(s.templateTitle)
    if (typeof s.templateEpisode === 'string') tmpl.setTemplateEpisode(s.templateEpisode)
    if (s.bgMode === 'color' || s.bgMode === 'image' || s.bgMode === 'transparent') setBgMode(s.bgMode)
    if (typeof s.bgColor === 'string') setBgColor(s.bgColor)
    if (typeof s.bgOpacity === 'number') setBgOpacity(s.bgOpacity)
    if (s.bgFillStyle === 'solid' || s.bgFillStyle === 'gradient') setBgFillStyle(s.bgFillStyle)
    if (typeof s.bgGradientFrom === 'string') setBgGradientFrom(s.bgGradientFrom)
    if (typeof s.bgGradientTo === 'string') setBgGradientTo(s.bgGradientTo)
    if (s.bgGradientDirection === 'vertical' || s.bgGradientDirection === 'horizontal') setBgGradientDirection(s.bgGradientDirection)
    if (doc.canvas) {
      await applyCanvasFromHistorySnapshot(JSON.stringify(doc.canvas))
    }
    tmpl.setTemplateMode(true)
  }

  async function loadCoverTemplate() {
    setError(null)
    if (!electron?.selectFiles || !electron?.readFileAsDataUrl) {
      setError('โหลดเทมเพลตได้เฉพาะใน Electron')
      return
    }
    setBusy(true)
    try {
      let defaultPath: string | undefined
      const projectRel = getActiveProjectRelRoot()
      if (workspaceRoot && projectRel) {
        const coversRel = ((activeProject?.paths as { media?: { covers?: string } } | undefined)?.media?.covers) ?? 'Cover'
        const sep = workspaceRoot.includes('\\') ? '\\' : '/'
        defaultPath = [workspaceRoot, projectRel, coversRel].filter(Boolean).join(sep)
      }
      const selected = await electron.selectFiles({
        properties: ['openFile'],
        filters: [{ name: 'เทมเพลตปก INKIDEA', extensions: ['json'] }],
        ...(defaultPath ? { defaultPath } : {}),
      })
      const filePath = Array.isArray(selected) ? selected[0] : null
      if (!filePath) return
      const result = await electron.readFileAsDataUrl({ filePath })
      const dataUrl = typeof result === 'string' ? result : ((result as { dataUrl?: string } | undefined)?.dataUrl)
      if (!dataUrl) {
        setError('ไม่พบเนื้อหาเทมเพลต')
        return
      }
      await applyCoverTemplateDoc(decodeDataUrlAsUtf8Text(dataUrl))
    } catch (e) {
      setError(`โหลดเทมเพลตไม่สำเร็จ: ${formatLoadError(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function loadCoverTemplateFromProject() {
    setError(null)
    if (!electron?.hubReadWorkspaceTextFile) {
      setError('โหลดเทมเพลตได้เฉพาะใน Electron')
      return
    }
    const relPath = buildProjectTemplateRelPath()
    if (!relPath) {
      setError('ยังไม่ได้เลือกโปรเจกต์')
      return
    }
    setBusy(true)
    try {
      const res = await electron.hubReadWorkspaceTextFile({ relPath })
      if (res?.missing) {
        setError('โปรเจกต์นี้ยังไม่มีเทมเพลตที่บันทึกไว้')
        return
      }
      await applyCoverTemplateDoc(String(res?.content ?? ''))
    } catch (e) {
      setError(`โหลดเทมเพลตไม่สำเร็จ: ${formatLoadError(e)}`)
    } finally {
      setBusy(false)
    }
  }

  function scheduleHistoryCommit() {
    if (historyMuteRef.current || isApplyingHistoryRef.current) return
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current)
    historyDebounceRef.current = setTimeout(() => {
      historyDebounceRef.current = null
      const canvas = fabricRef.current
      if (!canvas || historyMuteRef.current || isApplyingHistoryRef.current) return
      let snap: string
      try {
        const json = canvas.toJSON()
        snap = JSON.stringify({ ...json, width: CANVAS_W, height: CANVAS_H })
      } catch { return }
      const stack = historyRef.current
      const idx = historyIndexRef.current
      if (stack[idx] === snap) return
      stack.splice(idx + 1)
      stack.push(snap)
      while (stack.length > 80) { stack.shift(); historyIndexRef.current = Math.max(0, historyIndexRef.current - 1) }
      historyIndexRef.current = stack.length - 1
      setHistoryStamp((s) => s + 1)
    }, 300)
  }

  async function undoCanvas() {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    const snap = historyRef.current[historyIndexRef.current]
    if (snap === undefined) return
    await applyCanvasFromHistorySnapshot(snap)
    setHistoryStamp((s) => s + 1)
  }

  async function redoCanvas() {
    const stack = historyRef.current
    if (historyIndexRef.current >= stack.length - 1) return
    historyIndexRef.current += 1
    const snap = stack[historyIndexRef.current]
    if (snap === undefined) return
    await applyCanvasFromHistorySnapshot(snap)
    setHistoryStamp((s) => s + 1)
  }

  function freeTransformActive() {
    const c = fabricRef.current
    if (!c) return
    const obj = c.getActiveObject()
    if (!obj || !(obj as any).inkideaLayerId) return
    const kind = (obj as any).inkideaLayerKind as InkLayerKind
    if (kind === 'background') return
    if (obj instanceof fabric.Textbox && obj.isEditing) obj.exitEditing()
    c.setActiveObject(obj)
    obj.setCoords()
    c.requestRenderAll()
  }

  function applyLayerAngle(deg: number) {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj) return
    if ((obj as any).inkideaLayerKind === 'background') return
    obj.set({ angle: deg })
    obj.setCoords()
    c.requestRenderAll()
  }

  function resetSelectedLayerTransform() {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj) return
    if ((obj as any).inkideaLayerKind === 'background') return
    const d = (obj as any).inkideaDefaults as Record<string, number> | undefined
    if (d) {
      obj.set({
        left: d.inkideaDefaultLeft ?? obj.left,
        top: d.inkideaDefaultTop ?? obj.top,
        angle: d.inkideaDefaultAngle ?? 0,
        scaleX: d.inkideaDefaultScaleX ?? 1,
        scaleY: d.inkideaDefaultScaleY ?? 1,
        skewX: d.inkideaDefaultSkewX ?? 0,
        skewY: d.inkideaDefaultSkewY ?? 0,
        originX: d.inkideaDefaultOriginX ?? obj.originX,
        originY: d.inkideaDefaultOriginY ?? obj.originY,
      })
    } else {
      obj.set({ angle: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 })
    }
    obj.setCoords()
    c.setActiveObject(obj)
    c.requestRenderAll()
    setLayerAngleDeg(Math.round(obj.angle ?? 0))
    scheduleHistoryCommit()
  }

  shortcutRef.current.undo = undoCanvas
  shortcutRef.current.redo = redoCanvas
  shortcutRef.current.ft = freeTransformActive

  function syncLayers() {
    const c = fabricRef.current
    if (!c) return
    const items: InkLayer[] = c
      .getObjects()
      .map((o) => {
        const kind = (o as any).inkideaLayerKind as InkLayerKind | undefined
        if (!kind) return null
        return {
          id: String((o as any).inkideaLayerId ?? ''),
          kind,
          label: String((o as any).inkideaLayerLabel ?? ''),
          visible: !!o.visible,
        }
      })
      .filter(Boolean) as InkLayer[]
    setLayers(items)
  }

  function syncSelectionFromCanvas() {
    const c = fabricRef.current
    if (!c) return
    const active = c.getActiveObject()
    if (!active) { setSelectedLayerId(null); return }
    setSelectedLayerId(((active as any).inkideaLayerId as string | undefined) ?? null)
  }

  function applyTextFromState(target: fabric.Textbox) {
    target.removeStyle('fill')
    const fill =
      fillMode === 'solid'
        ? textFill
        : textObjectGradientForTextbox(target, gradientDirection, gradientFrom, gradientTo)
    const paintFirst: 'fill' | 'stroke' = textStrokeAlign === 'inside' ? 'stroke' : 'fill'
    target.set({
      text: textValue, fontSize: textFontSize, fontFamily: textFontFamily,
      fill, opacity: clamp(textOpacity, 0, 1), textAlign,
      stroke: strokeEnabled ? strokeColor : undefined,
      strokeWidth: strokeEnabled ? strokeWidth : 0,
      paintFirst,
    })
    target.set('dirty', true)
  }

  function resetView() {
    viewZoomPercentRef.current = 100
    setViewZoomPercent(100)
    queueMicrotask(() => fitCanvasToHostRef.current())
  }

  // ---------------------------------------------------------------------------
  // Layer creation / management
  // ---------------------------------------------------------------------------

  async function chooseAddImageLayer() {
    setError(null)
    try {
      const source = await pickImageSourceAsync(electron, imagePickerRef)
      if (!source) return
      const imgUrl = await imageSourceToDataUrlAsync(source, electron)
      await addImageLayerFromDataUrl(imgUrl)
    } catch (e) {
      setError(`เพิ่มเลเยอร์ภาพไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  async function addImageLayerFromDataUrl(dataUrl: string) {
    setError(null)
    try {
      const c = fabricRef.current
      if (!c) return
      const fabricImage = await createFabricImageFromDataUrl(dataUrl)
      const id = newId()
      const maxW = CANVAS_W * 0.65
      const maxH = CANVAS_H * 0.65
      const scale = Math.min(maxW / (fabricImage.width || 1), maxH / (fabricImage.height || 1), 1)
      fabricImage.set({ left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale, opacity: 1 })
      fabricImage.setControlsVisibility({ mt: true, mr: true, mb: true, ml: true, br: true, bl: true, tr: true, tl: true, mtr: true })
      ;(fabricImage as any).inkideaLayerId = id
      ;(fabricImage as any).inkideaLayerKind = 'image'
      ;(fabricImage as any).inkideaLayerLabel = 'เลเยอร์ภาพ'
      c.add(fabricImage)
      stampInkideaTransformDefaults(fabricImage)
      c.setActiveObject(fabricImage)
      c.requestRenderAll()
      syncSelectionFromCanvas()
      syncLayers()
      scheduleHistoryCommit()
    } catch (e) {
      setError(`เพิ่มเลเยอร์ภาพไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  function addTextLayer() {
    const c = fabricRef.current
    if (!c) return
    const id = newId()
    const text = new fabric.Textbox('ข้อความ', {
      left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center',
      width: 240, fontFamily: 'Tahoma', fontSize: 48,
      fill: '#ffffff', opacity: 1, textAlign: 'center',
      stroke: undefined, strokeWidth: 0,
      selectable: true, editable: true, hasControls: true, hasRotatingPoint: true, padding: 4,
    })
    ;(text as any).inkideaLayerId = id
    ;(text as any).inkideaLayerKind = 'text'
    ;(text as any).inkideaLayerLabel = 'เลเยอร์ข้อความ'
    c.add(text)
    tightenTextboxWidth(text)
    stampInkideaTransformDefaults(text)
    c.setActiveObject(text)
    c.requestRenderAll()
    syncSelectionFromCanvas()
    syncLayers()
  }

  function addRectangleLayer() {
    const c = fabricRef.current
    if (!c) return
    const id = newId()
    const rect = new fabric.Rect({
      left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center',
      width: Math.round(CANVAS_W * 0.42), height: Math.round(CANVAS_H * 0.32),
      fill: shapeFill, stroke: shapeStrokeWidth > 0 ? shapeStroke : undefined,
      strokeWidth: shapeStrokeWidth, opacity: clamp(shapeOpacity, 0, 1), rx: 8, ry: 8,
    })
    ;(rect as any).inkideaLayerId = id
    ;(rect as any).inkideaLayerKind = 'shape'
    ;(rect as any).inkideaLayerLabel = 'สี่เหลี่ยม'
    c.add(rect)
    stampInkideaTransformDefaults(rect)
    c.setActiveObject(rect)
    c.requestRenderAll()
    syncSelectionFromCanvas()
    syncLayers()
  }

  function addCircleLayer() {
    const c = fabricRef.current
    if (!c) return
    const id = newId()
    const r = Math.round(Math.min(CANVAS_W, CANVAS_H) * 0.14)
    const circle = new fabric.Circle({
      left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center',
      radius: r, fill: shapeFill,
      stroke: shapeStrokeWidth > 0 ? shapeStroke : undefined,
      strokeWidth: shapeStrokeWidth, opacity: clamp(shapeOpacity, 0, 1),
    })
    ;(circle as any).inkideaLayerId = id
    ;(circle as any).inkideaLayerKind = 'shape'
    ;(circle as any).inkideaLayerLabel = 'วงกลม'
    c.add(circle)
    stampInkideaTransformDefaults(circle)
    c.setActiveObject(circle)
    c.requestRenderAll()
    syncSelectionFromCanvas()
    syncLayers()
  }

  function deleteSelectedLayer() {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj) return
    if ((obj as any).inkideaLayerKind === 'background') return
    c.remove(obj)
    c.discardActiveObject()
    c.requestRenderAll()
    setSelectedLayerId(null)
    syncLayers()
  }

  function bringForwardSelected() {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj) return
    reorderFabricObjectStep(c, obj, +1)
    syncLayers()
    scheduleHistoryCommit()
  }

  function sendBackwardSelected() {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj) return
    reorderFabricObjectStep(c, obj, -1)
    syncLayers()
    scheduleHistoryCommit()
  }

  async function duplicateSelected() {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj || (obj as any).inkideaLayerKind === 'background') return
    const clone = await obj.clone() as fabric.Object
    const id = newId()
    ;(clone as any).inkideaLayerId = id
    const label = String((obj as any).inkideaLayerLabel ?? 'เลเยอร์')
    ;(clone as any).inkideaLayerLabel = `${label} (สำเนา)`
    clone.set({ left: (obj.left ?? 0) + 12, top: (obj.top ?? 0) + 12 })
    stampInkideaTransformDefaults(clone)
    c.add(clone)
    c.setActiveObject(clone)
    c.requestRenderAll()
    syncSelectionFromCanvas()
    syncLayers()
    scheduleHistoryCommit()
  }

  // ---------------------------------------------------------------------------
  // Canvas init effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return setupCoverCanvas(
      {
        canvasRef, canvasHostRef, canvasBoundaryRef, artboardFrameRef, fabricRef,
        backgroundRectIdRef, numberLayerIdRef,
        fitCanvasToHostRef, viewZoomPercentRef, syncAngleFromActiveRef,
        historyDebounceRef, templateBgRefreshTimerRef: tmpl.templateBgRefreshTimerRef,
        historyRef, historyIndexRef,
      },
      { setViewZoomPercent, setHistoryStamp },
      {
        initialBgColor: bgColor,
        initialBgMode: bgMode,
        initialBgOpacity: bgOpacity,
        syncSelectionFromCanvas,
        syncLayers,
        scheduleHistoryCommit,
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const c = fabricRef.current
    if (!c) return
    if (bgMode === 'transparent' || bgMode === 'image') {
      c.backgroundColor = 'transparent'
    } else if (bgFillStyle === 'gradient') {
      c.backgroundColor = canvasBgGradient(bgGradientDirection, bgGradientFrom, bgGradientTo) as unknown as string
    } else {
      c.backgroundColor = hexToRgba(bgColor, clamp(bgOpacity, 0, 1))
    }
    c.requestRenderAll()
  }, [bgColor, bgOpacity, bgMode, bgFillStyle, bgGradientFrom, bgGradientTo, bgGradientDirection])

  useEffect(() => { fitCanvasToHostRef.current() }, [viewZoomPercent])

  useEffect(() => {
    if (!programActive) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target
      if (el instanceof Element && el.closest('input, textarea, select, [contenteditable="true"]')) return
      const c = fabricRef.current
      if (!c) return
      const active = c.getActiveObject()
      const inTextEdit = active instanceof fabric.Textbox && active.isEditing
      if (inTextEdit) {
        // ใน edit mode ของ Textbox — ปล่อย key พื้นฐานของ Fabric ทำงาน,
        // อนุญาตเฉพาะ Ctrl+T (Free Transform) ที่ต้อง override
        if ((e.metaKey || e.ctrlKey) && e.code === 'KeyT') { e.preventDefault(); shortcutRef.current.ft() }
        return
      }
      const mod = e.metaKey || e.ctrlKey
      const shift = e.shiftKey

      // ─── History ────────────────────────────────────────────────────
      if (mod && e.code === 'KeyZ' && !shift) { e.preventDefault(); void shortcutRef.current.undo(); return }
      if ((mod && shift && e.code === 'KeyZ') || (e.ctrlKey && !e.metaKey && e.code === 'KeyY')) { e.preventDefault(); void shortcutRef.current.redo(); return }

      // ─── Transform ──────────────────────────────────────────────────
      if (mod && e.code === 'KeyT') { e.preventDefault(); shortcutRef.current.ft(); return }

      // ─── View — Photoshop conventions ───────────────────────────────
      // Ctrl+0 = Fit on Screen, Ctrl+1 = Actual Pixels 100%
      if (mod && e.code === 'Digit0') {
        e.preventDefault()
        const h = canvasHostRef.current
        const fw = Math.max((h?.clientWidth ?? 0) - 48, 80)
        const fh = Math.max((h?.clientHeight ?? 0) - 48, 80)
        const fitScale = Math.min(fw / CANVAS_W, fh / CANVAS_H, 1)
        setViewZoomPercent(Math.max(10, Math.min(400, Math.round(100 * fitScale))))
        return
      }
      if (mod && e.code === 'Digit1') { e.preventDefault(); setViewZoomPercent(100); return }
      if (mod && (e.code === 'Equal' || e.code === 'NumpadAdd')) { e.preventDefault(); setViewZoomPercent((p) => Math.min(400, p + 10)); return }
      if (mod && (e.code === 'Minus' || e.code === 'NumpadSubtract')) { e.preventDefault(); setViewZoomPercent((p) => Math.max(10, p - 10)); return }

      // ─── Selection ──────────────────────────────────────────────────
      // Esc — deselect
      if (!mod && !shift && e.code === 'Escape') {
        if (c.getActiveObject()) {
          e.preventDefault()
          c.discardActiveObject()
          c.requestRenderAll()
          syncSelectionFromCanvas()
        }
        return
      }
      // Ctrl+D — deselect (Photoshop convention)
      if (mod && !shift && e.code === 'KeyD') {
        e.preventDefault()
        c.discardActiveObject()
        c.requestRenderAll()
        syncSelectionFromCanvas()
        return
      }
      // Ctrl+A — select all (ยกเว้น background)
      if (mod && !shift && e.code === 'KeyA') {
        e.preventDefault()
        const objs = c.getObjects().filter((o) => (o as any).inkideaLayerKind !== 'background' && o.selectable !== false)
        if (objs.length === 0) return
        c.discardActiveObject()
        if (objs.length === 1) {
          c.setActiveObject(objs[0])
        } else {
          const sel = new fabric.ActiveSelection(objs, { canvas: c })
          c.setActiveObject(sel)
        }
        c.requestRenderAll()
        syncSelectionFromCanvas()
        return
      }

      // ─── Layer ops ──────────────────────────────────────────────────
      // Delete / Backspace — delete selected layer
      if (!mod && (e.code === 'Delete' || e.code === 'Backspace')) {
        if (!selectedLayerIdRef.current) return
        e.preventDefault()
        deleteSelectedLayer()
        return
      }
      // Ctrl+J — duplicate
      if (mod && !shift && e.code === 'KeyJ') {
        e.preventDefault()
        void duplicateSelected()
        return
      }
      // Ctrl+] / Ctrl+[ — bring forward / send backward
      // Ctrl+Shift+] / Ctrl+Shift+[ — bring to front / send to back
      if (mod && e.code === 'BracketRight') {
        if (!selectedLayerIdRef.current) return
        e.preventDefault()
        if (shift) {
          const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerIdRef.current)
          if (obj) { reorderFabricObjectStep(c, obj, 9999); syncLayers(); scheduleHistoryCommit() }
        } else {
          bringForwardSelected()
        }
        return
      }
      if (mod && e.code === 'BracketLeft') {
        if (!selectedLayerIdRef.current) return
        e.preventDefault()
        if (shift) {
          const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerIdRef.current)
          if (obj) { reorderFabricObjectStep(c, obj, -9999); syncLayers(); scheduleHistoryCommit() }
        } else {
          sendBackwardSelected()
        }
        return
      }

      // ─── Nudge — arrow keys move selected object by 1px (10px with Shift) ──
      if (!mod && (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        const act = c.getActiveObject()
        if (!act) return
        if ((act as any).inkideaLayerKind === 'background') return
        e.preventDefault()
        const step = shift ? 10 : 1
        if (e.code === 'ArrowUp') act.set({ top: (act.top ?? 0) - step })
        if (e.code === 'ArrowDown') act.set({ top: (act.top ?? 0) + step })
        if (e.code === 'ArrowLeft') act.set({ left: (act.left ?? 0) - step })
        if (e.code === 'ArrowRight') act.set({ left: (act.left ?? 0) + step })
        act.setCoords()
        c.requestRenderAll()
        syncAngleFromActiveRef.current()
        scheduleHistoryCommit()
        return
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [programActive])

  useEffect(() => {
    const obj = selectedObject
    if (!obj) { setLayerAngleDeg(0); return }
    const kind = (obj as any).inkideaLayerKind as InkLayerKind | undefined
    if (kind && kind !== 'background') setLayerAngleDeg(Math.round((obj as fabric.Object).angle ?? 0))
    else setLayerAngleDeg(0)
    if (kind === 'text' && obj instanceof fabric.Textbox) {
      setTextValue(String(obj.text ?? ''))
      setTextFontSize(Number(obj.fontSize ?? 64))
      setTextFontFamily(typeof obj.fontFamily === 'string' ? obj.fontFamily : 'Tahoma')
      const nextAlign = obj.textAlign === 'left' || obj.textAlign === 'center' || obj.textAlign === 'right' ? obj.textAlign : 'center'
      setTextAlign(nextAlign)
      setTextOpacity(typeof obj.opacity === 'number' ? obj.opacity : 1)
      setStrokeEnabled(!!obj.stroke)
      setStrokeWidth(Number(obj.strokeWidth ?? 3))
      setStrokeColor(typeof obj.stroke === 'string' ? obj.stroke : strokeColor)
      setTextFill(typeof obj.fill === 'string' ? obj.fill : textFill)
      const fillIsGradient = typeof obj.fill === 'object' && obj.fill !== null
      setFillMode(fillIsGradient ? 'gradient' : 'solid')
      const propsFrom = (obj as any).inkideaGradientFrom as string | undefined
      const propsTo = (obj as any).inkideaGradientTo as string | undefined
      const propsDir = (obj as any).inkideaGradientDirection as string | undefined
      if (propsFrom) setGradientFrom(propsFrom)
      if (propsTo) setGradientTo(propsTo)
      if (propsDir === 'vertical' || propsDir === 'horizontal') setGradientDirection(propsDir)
      const paintFirst = (obj as fabric.Textbox & { paintFirst?: string }).paintFirst
      setTextStrokeAlign(paintFirst === 'stroke' ? 'inside' : 'outside')
    }
    if (kind === 'image') setImageOpacity(clamp(typeof obj.opacity === 'number' ? obj.opacity : 1, 0, 1))
    if (kind === 'shape' && (obj instanceof fabric.Rect || obj instanceof fabric.Circle)) {
      setShapeFill(typeof obj.fill === 'string' ? obj.fill : '#f59e0b')
      setShapeStroke(typeof obj.stroke === 'string' ? obj.stroke : '#0f172a')
      setShapeStrokeWidth(Number(obj.strokeWidth ?? 0))
      setShapeOpacity(typeof obj.opacity === 'number' ? obj.opacity : 1)
    }
  }, [selectedObject])

  useEffect(() => {
    const c = fabricRef.current
    if (!c || !selectedLayerId) return
    const obj = c.getObjects().find((o) => (o as any).inkideaLayerId === selectedLayerId)
    if (!obj) return
    const kind = (obj as any).inkideaLayerKind as InkLayerKind | undefined
    if (kind === 'text' && obj instanceof fabric.Textbox) {
      applyTextFromState(obj)
      ;(obj as any).inkideaGradientFrom = gradientFrom
      ;(obj as any).inkideaGradientTo = gradientTo
      ;(obj as any).inkideaGradientDirection = gradientDirection
      tightenTextboxWidth(obj)
      if (textFontFamily) localStorage.setItem('inkidea-cover-last-font', textFontFamily)
      c.requestRenderAll()
    }
    if (kind === 'image') { obj.set({ opacity: clamp(imageOpacity, 0, 1) }); c.requestRenderAll() }
    if (kind === 'shape' && (obj instanceof fabric.Rect || obj instanceof fabric.Circle)) {
      obj.set({ fill: shapeFill, stroke: shapeStrokeWidth > 0 ? shapeStroke : undefined, strokeWidth: shapeStrokeWidth, opacity: clamp(shapeOpacity, 0, 1) })
      c.requestRenderAll()
    }
  }, [textValue, textFontSize, textFontFamily, textFill, textOpacity, textAlign, strokeEnabled, strokeWidth, strokeColor, fillMode, gradientFrom, gradientTo, gradientDirection, imageOpacity, shapeFill, shapeStroke, shapeStrokeWidth, shapeOpacity, textStrokeAlign, selectedLayerId])

  void historyStamp
  const canHistoryUndo = historyIndexRef.current > 0
  const canHistoryRedo = historyIndexRef.current < historyRef.current.length - 1

  return {
    electron, programActive,
    fabricRef, canvasRef, canvasHostRef, canvasBoundaryRef, artboardFrameRef, imagePickerRef, backgroundImageIdRef,
    layers, selectedLayerId, setSelectedLayerId, selectedObject,
    busy, error, setError,
    bgMode, setBgMode, bgColor, setBgColor, bgOpacity, setBgOpacity,
    bgFillStyle, setBgFillStyle, bgGradientFrom, setBgGradientFrom,
    bgGradientTo, setBgGradientTo, bgGradientDirection, setBgGradientDirection,
    textValue, setTextValue, textFontSize, setTextFontSize, textFontFamily, setTextFontFamily,
    textFill, setTextFill, textOpacity, setTextOpacity, textAlign, setTextAlign,
    strokeEnabled, setStrokeEnabled, strokeWidth, setStrokeWidth, strokeColor, setStrokeColor,
    textStrokeAlign, setTextStrokeAlign,
    fillMode, setFillMode, gradientFrom, setGradientFrom, gradientTo, setGradientTo,
    gradientDirection, setGradientDirection,
    imageOpacity, setImageOpacity,
    shapeFill, setShapeFill, shapeStroke, setShapeStroke, shapeStrokeWidth, setShapeStrokeWidth, shapeOpacity, setShapeOpacity,
    layerAngleDeg, setLayerAngleDeg,
    viewZoomPercent, setViewZoomPercent,
    canHistoryUndo, canHistoryRedo,
    syncLayers, syncSelectionFromCanvas,
    undoCanvas, redoCanvas, freeTransformActive,
    applyLayerAngle, resetSelectedLayerTransform,
    bringForwardSelected, sendBackwardSelected, duplicateSelected, resetView,
    chooseAddImageLayer, addImageLayerFromDataUrl,
    addTextLayer, addRectangleLayer, addCircleLayer, deleteSelectedLayer,
    saveCoverTemplate, loadCoverTemplate, loadCoverTemplateFromProject, revealCoverTemplateFolder,
    getFabricObjectById: (id: string | null) => getFabricObjectById(fabricRef.current, id),
    // Template + bg image (from sub-hook)
    ...tmpl,
    // Export (from sub-hook)
    ...exportHook,
    // Per-layer adjustments
    ...adjustmentsHook,
  }
}
