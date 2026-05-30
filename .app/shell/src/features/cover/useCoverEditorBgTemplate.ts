import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import * as fabric from 'fabric'
import {
  newId,
  stampInkideaTransformDefaults,
  tightenTextboxWidth,
  formatLoadError,
  getFabricObjectById,
  reorderFabricObjectToBack,
  createFabricImageFromDataUrl,
  cropImageDataUrlToRatio,
  pickImageSourceAsync,
  imageSourceToDataUrlAsync,
  applyAdjustmentsToObject,
} from './coverEditorUtils'
import {
  CANVAS_W,
  CANVAS_H,
  TEMPLATE_TEXT_CENTER_X,
  TEMPLATE_TITLE_TOP,
  TEMPLATE_EPISODE_TOP,
  TEMPLATE_TITLE_WIDTH,
  TEMPLATE_EPISODE_WIDTH,
  TEMPLATE_BG_DEFAULT_ADJUSTMENTS,
  type LocalFontData,
} from './coverEditorTypes'

interface BgTemplateDeps {
  fabricRef: MutableRefObject<fabric.Canvas | null>
  backgroundImageIdRef: MutableRefObject<string | null>
  numberLayerIdRef: MutableRefObject<string | null>
  imagePickerRef: RefObject<HTMLInputElement | null>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  electron: any
  syncLayers: () => void
  setError: Dispatch<SetStateAction<string | null>>
  setSelectedLayerId: Dispatch<SetStateAction<string | null>>
  bgMode: 'color' | 'image' | 'transparent'
  setBgMode: Dispatch<SetStateAction<'color' | 'image' | 'transparent'>>
}

export function useCoverEditorBgTemplate({
  fabricRef,
  backgroundImageIdRef,
  numberLayerIdRef,
  imagePickerRef,
  electron,
  syncLayers,
  setError,
  setSelectedLayerId: _setSelectedLayerId,
  bgMode,
  setBgMode,
}: BgTemplateDeps) {
  const [templateMode, setTemplateMode] = useState(false)
  const [templateTitle, setTemplateTitle] = useState<string>('ชื่อเรื่อง')
  const [templateEpisode, setTemplateEpisode] = useState<string>('001-050')
  const [templateApplyDefaults, setTemplateApplyDefaults] = useState(true)
  const [templateCreditVisible, setTemplateCreditVisible] = useState(true)
  const [templateFontChoice, setTemplateFontChoice] = useState<string>(() =>
    localStorage.getItem('inkidea-cover-last-font') || 'Tahoma'
  )
  const [localFonts, setLocalFonts] = useState<string[]>([])
  const [localFontsSupported, setLocalFontsSupported] = useState(false)
  const [fontsBusy, setFontsBusy] = useState(false)

  const templateCoverIdRef = useRef<string | null>(null)
  const templateTitleIdRef = useRef<string | null>(null)
  const templateCreditIdRef = useRef<string | null>(null)
  const templateBgRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fontChoices = useMemo(() => {
    const defaults = ['Tahoma', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS']
    return [...new Set([...defaults, ...localFonts])].sort((a, b) => a.localeCompare(b))
  }, [localFonts])

  // ---------------------------------------------------------------------------
  // Template helpers
  // ---------------------------------------------------------------------------

  function snapTemplateTitleAndEpisodeLayout() {
    const c = fabricRef.current
    if (!c) return
    const titleObj = getFabricObjectById<fabric.Textbox>(c, templateTitleIdRef.current)
    const numberObj = getFabricObjectById<fabric.Textbox>(c, numberLayerIdRef.current)
    if (titleObj && (titleObj as fabric.Textbox & { inkideaLayerLabel?: string }).inkideaLayerLabel === 'ชื่อเรื่อง') {
      titleObj.set({ left: TEMPLATE_TEXT_CENTER_X, top: TEMPLATE_TITLE_TOP, originX: 'center', originY: 'center', width: TEMPLATE_TITLE_WIDTH, textAlign: 'center' })
      stampInkideaTransformDefaults(titleObj)
    }
    if (numberObj && (numberObj as fabric.Textbox & { inkideaLayerLabel?: string }).inkideaLayerLabel === 'Number') {
      numberObj.set({ left: TEMPLATE_TEXT_CENTER_X, top: TEMPLATE_EPISODE_TOP, originX: 'center', originY: 'center', width: TEMPLATE_EPISODE_WIDTH, textAlign: 'center' })
      stampInkideaTransformDefaults(numberObj)
    }
    c.requestRenderAll()
  }

  /**
   * ensureNumberLayer — รับประกันว่ามีเลเยอร์ "Number" (เลขตอน) อยู่บนแคนวาสเสมอ
   * แยกออกมาเพื่อเรียกได้จากทุก flow: อัปปก, อัปพื้นหลัง, หรือปุ่ม "+ เลขตอน" โดยตรง
   * คืน id ของเลเยอร์ (หรือ null ถ้าแคนวาสยังไม่พร้อม) — batch export ค้นด้วย label 'Number'
   */
  function ensureNumberLayer(): string | null {
    const c = fabricRef.current
    if (!c) return null
    // ref ชี้ object ที่ถูกลบไปแล้ว → เคลียร์ให้สร้างใหม่
    if (numberLayerIdRef.current && !getFabricObjectById(c, numberLayerIdRef.current)) {
      numberLayerIdRef.current = null
    }
    if (!numberLayerIdRef.current) {
      const id = newId()
      const numberText = new fabric.Textbox(templateEpisode, {
        left: TEMPLATE_TEXT_CENTER_X, top: TEMPLATE_EPISODE_TOP, originX: 'center', originY: 'center',
        width: TEMPLATE_EPISODE_WIDTH, textAlign: 'center', fontFamily: templateFontChoice,
        fontSize: 72, fill: '#ffffff', opacity: 1, padding: 6,
      } as unknown as fabric.TextboxProps)
      ;(numberText as fabric.Textbox & { inkideaLayerId?: string; inkideaLayerKind?: string; inkideaLayerLabel?: string }).inkideaLayerId = id
      ;(numberText as fabric.Textbox & { inkideaLayerKind?: string }).inkideaLayerKind = 'text'
      ;(numberText as fabric.Textbox & { inkideaLayerLabel?: string }).inkideaLayerLabel = 'Number'
      numberLayerIdRef.current = id
      c.add(numberText)
      tightenTextboxWidth(numberText)
      stampInkideaTransformDefaults(numberText)
    }
    const numberObj = getFabricObjectById<fabric.Textbox>(c, numberLayerIdRef.current)
    if (numberObj) {
      numberObj.set({ text: templateEpisode, fontFamily: templateFontChoice })
      tightenTextboxWidth(numberObj)
    }
    c.requestRenderAll()
    syncLayers()
    return numberLayerIdRef.current
  }

  function ensureTemplateTextObjects() {
    const c = fabricRef.current
    if (!c) return
    if (templateTitleIdRef.current && !getFabricObjectById(c, templateTitleIdRef.current)) {
      templateTitleIdRef.current = null
    }
    if (!templateTitleIdRef.current) {
      const id = newId()
      const title = new fabric.Textbox(templateTitle, {
        left: TEMPLATE_TEXT_CENTER_X, top: TEMPLATE_TITLE_TOP, originX: 'center', originY: 'center',
        width: TEMPLATE_TITLE_WIDTH, textAlign: 'center', fontFamily: templateFontChoice,
        fontSize: 54, fill: '#ffffff', opacity: 1,
      })
      ;(title as fabric.Textbox & { inkideaLayerId?: string; inkideaLayerKind?: string; inkideaLayerLabel?: string }).inkideaLayerId = id
      ;(title as fabric.Textbox & { inkideaLayerKind?: string }).inkideaLayerKind = 'text'
      ;(title as fabric.Textbox & { inkideaLayerLabel?: string }).inkideaLayerLabel = 'ชื่อเรื่อง'
      templateTitleIdRef.current = id
      c.add(title)
      tightenTextboxWidth(title)
      stampInkideaTransformDefaults(title)
    }
    const titleObj = getFabricObjectById<fabric.Textbox>(fabricRef.current, templateTitleIdRef.current)
    if (titleObj) {
      titleObj.set({ text: templateTitle, fontFamily: templateFontChoice })
      tightenTextboxWidth(titleObj)
    }
    // เลขตอนสร้าง/อัปเดตผ่าน helper เดียวกับ flow อื่น ๆ
    ensureNumberLayer()
    c.requestRenderAll()
    syncLayers()
  }

  function clearTemplateObjects() {
    const c = fabricRef.current
    if (!c) return
    const targetIds = [
      templateCoverIdRef.current,
      templateTitleIdRef.current,
      templateCreditIdRef.current,
    ].filter(Boolean)
    for (const id of targetIds) {
      const obj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === id)
      if (obj) c.remove(obj)
    }
    templateCoverIdRef.current = null
    templateTitleIdRef.current = null
    templateCreditIdRef.current = null
    c.discardActiveObject()
    c.requestRenderAll()
    syncLayers()
  }

  // ---------------------------------------------------------------------------
  // Background image functions
  // ---------------------------------------------------------------------------

  async function chooseBackgroundImage() {
    setError(null)
    try {
      const source = await pickImageSourceAsync(electron, imagePickerRef)
      if (!source) return
      const dataUrl = await imageSourceToDataUrlAsync(source, electron)
      await loadBackgroundImageFromDataUrl(dataUrl)
    } catch (e) {
      setError(`โหลดภาพพื้นหลังไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  async function placeBackgroundImage(dataUrl: string, opts: { applyDefaults: boolean; label: string }) {
    const c = fabricRef.current
    if (!c) throw new Error('ยังไม่พร้อมแคนวาส')
    const existingBgImg = backgroundImageIdRef.current
    if (existingBgImg) {
      const obj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === existingBgImg)
      if (obj) c.remove(obj)
      backgroundImageIdRef.current = null
    }
    const bgImage = await createFabricImageFromDataUrl(dataUrl)
    const bgScale = Math.max(CANVAS_W / (bgImage.width || CANVAS_W), CANVAS_H / (bgImage.height || CANVAS_H))
    bgImage.set({
      left: 0, top: 0, originX: 'left', originY: 'top',
      scaleX: bgScale, scaleY: bgScale,
      selectable: true, evented: true, lockRotation: true, hasRotatingPoint: false, hasControls: true, opacity: 1,
    })
    const id = newId()
    ;(bgImage as fabric.Image & { inkideaLayerId?: string; inkideaLayerKind?: string; inkideaLayerLabel?: string }).inkideaLayerId = id
    ;(bgImage as fabric.Image & { inkideaLayerKind?: string }).inkideaLayerKind = 'background'
    ;(bgImage as fabric.Image & { inkideaLayerLabel?: string }).inkideaLayerLabel = opts.label
    backgroundImageIdRef.current = id
    c.add(bgImage)
    reorderFabricObjectToBack(c, bgImage)
    if (opts.applyDefaults) {
      applyAdjustmentsToObject(bgImage, { ...TEMPLATE_BG_DEFAULT_ADJUSTMENTS })
    }
    setBgMode('image')
    c.requestRenderAll()
    syncLayers()
    return bgImage
  }

  async function loadBackgroundImageFromDataUrl(dataUrl: string) {
    setError(null)
    try {
      await placeBackgroundImage(dataUrl, { applyDefaults: false, label: 'พื้นหลัง (รูปภาพ)' })
      // รับประกันว่ามีเลขตอนเสมอ — ไม่ว่าจะเข้าทางอัปปกหรืออัปพื้นหลัง
      ensureNumberLayer()
    } catch (e) {
      setError(`โหลดภาพพื้นหลังไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  function clearBackgroundImage() {
    const c = fabricRef.current
    if (!c) return
    const bgId = backgroundImageIdRef.current
    if (!bgId) { setError('ยังไม่มีพื้นหลังรูปภาพให้ล้าง'); return }
    const bgObj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === bgId)
    if (bgObj) c.remove(bgObj)
    backgroundImageIdRef.current = null
    if (bgMode === 'image') setBgMode('color')
    c.requestRenderAll()
    syncLayers()
    setError(null)
  }

  async function loadTemplateCoverImage() {
    setError(null)
    try {
      const coverDataUrl = await chooseTemplateCoverImageForCrop()
      if (!coverDataUrl) return
      await loadTemplateCoverImageFromDataUrl(coverDataUrl)
    } catch (e) {
      setError(`โหลดภาพปกเทมเพลตไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  async function chooseTemplateCoverImageForCrop(): Promise<string | null> {
    setError(null)
    try {
      const source = await pickImageSourceAsync(electron, imagePickerRef)
      if (!source) return null
      return await imageSourceToDataUrlAsync(source, electron)
    } catch (e) {
      setError(`โหลดภาพปกไม่สำเร็จ: ${formatLoadError(e)}`)
      return null
    }
  }

  async function loadTemplateCoverImageFromDataUrl(coverDataUrl: string, sourceDataUrl?: string) {
    setError(null)
    try {
      const c = fabricRef.current
      if (!c) return
      // BG is always 16:9 to match the YouTube-cover artboard.
      // Prefer the original (uncropped) source so a 3:4 cover crop doesn't dictate BG aspect.
      const bgSource = sourceDataUrl ?? coverDataUrl
      let bgDataUrl = bgSource
      try {
        bgDataUrl = await cropImageDataUrlToRatio(bgSource, CANVAS_W / CANVAS_H)
      } catch {
        bgDataUrl = bgSource
      }
      await placeBackgroundImage(bgDataUrl, {
        applyDefaults: templateApplyDefaults,
        label: templateApplyDefaults ? 'พื้นหลัง (เบลอจากปก)' : 'พื้นหลัง (จากปก)',
      })
      let coverObj = getFabricObjectById<fabric.Image>(c, templateCoverIdRef.current)
      if (!coverObj) {
        const coverId = newId()
        const cover = await createFabricImageFromDataUrl(coverDataUrl)
        ;(cover as fabric.Image & { inkideaLayerId?: string; inkideaLayerKind?: string; inkideaLayerLabel?: string }).inkideaLayerId = coverId
        ;(cover as fabric.Image & { inkideaLayerKind?: string }).inkideaLayerKind = 'image'
        ;(cover as fabric.Image & { inkideaLayerLabel?: string }).inkideaLayerLabel = 'ภาพปก 3:4'
        templateCoverIdRef.current = coverId
        coverObj = cover
        c.add(cover)
      } else {
        const fresh = await createFabricImageFromDataUrl(coverDataUrl)
        coverObj.setElement(fresh.getElement())
      }
      const frameW = CANVAS_W * 0.22
      const frameH = frameW * (4 / 3)
      const coverScale = Math.max(frameW / (coverObj.width || frameW), frameH / (coverObj.height || frameH))
      coverObj.set({ left: CANVAS_W * 0.19, top: CANVAS_H * 0.43, originX: 'center', originY: 'center', scaleX: coverScale, scaleY: coverScale, opacity: 1 })
      stampInkideaTransformDefaults(coverObj)
      ensureTemplateTextObjects()
      snapTemplateTitleAndEpisodeLayout()
      setTemplateMode(true)
      setBgMode('image')
      c.requestRenderAll()
      syncLayers()
    } catch (e) {
      setError(`โหลดภาพปกเทมเพลตไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  async function loadTemplateCustomBackground(dataUrlFromCrop?: string) {
    setError(null)
    try {
      let dataUrl = dataUrlFromCrop ?? null
      if (!dataUrl) {
        const source = await pickImageSourceAsync(electron, imagePickerRef)
        if (!source) return
        dataUrl = await imageSourceToDataUrlAsync(source, electron)
      }
      await placeBackgroundImage(dataUrl, { applyDefaults: false, label: 'พื้นหลัง (อัปโหลดเอง)' })
      // อัปพื้นหลังก็ต้องได้ template (ชื่อเรื่อง + เลขตอน) เหมือนอัปปก —
      // เผื่อผู้ใช้ไม่อยากใช้ฟังก์ชันอัปปก แต่ยังต้องทำปกเป็นชุดด้วยเลขตอน {n}
      ensureTemplateTextObjects()
      snapTemplateTitleAndEpisodeLayout()
      setTemplateMode(true)
    } catch (e) {
      setError(`โหลดภาพพื้นหลังเทมเพลตไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  async function loadTemplateCreditImage(dataUrlFromCrop?: string) {
    setError(null)
    try {
      let dataUrl = dataUrlFromCrop ?? null
      if (!dataUrl) {
        const source = await pickImageSourceAsync(electron, imagePickerRef)
        if (!source) return
        dataUrl = await imageSourceToDataUrlAsync(source, electron)
      }
      const c = fabricRef.current
      if (!c) return
      let creditObj = getFabricObjectById<fabric.Image>(c, templateCreditIdRef.current)
      if (!creditObj) {
        const creditId = newId()
        const credit = await createFabricImageFromDataUrl(dataUrl)
        ;(credit as fabric.Image & { inkideaLayerId?: string; inkideaLayerKind?: string; inkideaLayerLabel?: string }).inkideaLayerId = creditId
        ;(credit as fabric.Image & { inkideaLayerKind?: string }).inkideaLayerKind = 'image'
        ;(credit as fabric.Image & { inkideaLayerLabel?: string }).inkideaLayerLabel = 'เครดิต 3:1'
        templateCreditIdRef.current = creditId
        creditObj = credit
        c.add(credit)
      } else {
        const fresh = await createFabricImageFromDataUrl(dataUrl)
        creditObj.setElement(fresh.getElement())
      }
      const creditW = CANVAS_W * 0.22
      const creditH = creditW / 3
      const creditScale = Math.max(creditW / (creditObj.width || creditW), creditH / (creditObj.height || creditH))
      creditObj.set({ left: CANVAS_W * 0.19, top: CANVAS_H * 0.79, originX: 'center', originY: 'center', scaleX: creditScale, scaleY: creditScale, visible: templateCreditVisible })
      stampInkideaTransformDefaults(creditObj)
      setTemplateMode(true)
      c.requestRenderAll()
      syncLayers()
    } catch (e) {
      setError(`โหลดเครดิตไม่สำเร็จ: ${formatLoadError(e)}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (templateFontChoice) localStorage.setItem('inkidea-cover-last-font', templateFontChoice)
  }, [templateFontChoice])

  useEffect(() => {
    let cancelled = false
    const loadLocalFonts = async () => {
      setFontsBusy(true)
      try {
        const queryFonts = (window as unknown as { queryLocalFonts?: () => Promise<LocalFontData[]> }).queryLocalFonts
        if (typeof queryFonts === 'function') {
          setLocalFontsSupported(true)
          const fonts = await queryFonts()
          if (cancelled) return
          const families = [...new Set(fonts.map((f) => String(f.family || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
          setLocalFonts(families)
          return
        }
        if (electron?.listFonts) {
          setLocalFontsSupported(true)
          const families: string[] = await electron.listFonts()
          if (cancelled) return
          setLocalFonts(families.filter(Boolean).sort((a, b) => a.localeCompare(b)))
          return
        }
        setLocalFontsSupported(false)
      } catch {
        if (!cancelled) {
          try {
            if (electron?.listFonts) {
              setLocalFontsSupported(true)
              const families: string[] = await electron.listFonts()
              if (!cancelled) setLocalFonts(families.filter(Boolean).sort((a, b) => a.localeCompare(b)))
            } else {
              setLocalFontsSupported(false)
              setLocalFonts([])
            }
          } catch {
            if (!cancelled) { setLocalFontsSupported(false); setLocalFonts([]) }
          }
        }
      } finally {
        if (!cancelled) setFontsBusy(false)
      }
    }
    loadLocalFonts()
    return () => { cancelled = true }
  }, [electron])

  useEffect(() => {
    if (!templateMode) return
    ensureTemplateTextObjects()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateMode, templateTitle, templateEpisode, templateFontChoice])

  useEffect(() => {
    const creditObj = getFabricObjectById<fabric.Image>(fabricRef.current, templateCreditIdRef.current)
    if (!creditObj) return
    creditObj.set({ visible: templateCreditVisible })
    fabricRef.current?.requestRenderAll()
    syncLayers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateCreditVisible])

  return {
    templateMode, setTemplateMode,
    templateTitle, setTemplateTitle,
    templateEpisode, setTemplateEpisode,
    templateApplyDefaults, setTemplateApplyDefaults,
    templateCreditVisible, setTemplateCreditVisible,
    templateFontChoice, setTemplateFontChoice,
    localFonts, localFontsSupported, fontsBusy, fontChoices,
    templateCoverIdRef, templateTitleIdRef, templateCreditIdRef, templateBgRefreshTimerRef,
    clearTemplateObjects, ensureTemplateTextObjects, ensureNumberLayer, snapTemplateTitleAndEpisodeLayout,
    chooseBackgroundImage, clearBackgroundImage, loadBackgroundImageFromDataUrl,
    chooseTemplateCoverImageForCrop,
    loadTemplateCoverImage, loadTemplateCoverImageFromDataUrl, loadTemplateCustomBackground, loadTemplateCreditImage,
  }
}
