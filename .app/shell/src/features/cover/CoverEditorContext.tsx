import { createContext, useContext, type MutableRefObject } from 'react'
import type * as fabric from 'fabric'
import type { InkLayer, InkLayerKind, LayerAdjustments } from './coverEditorTypes'
import type { CoverCropKind } from './CoverCropDialog'

export type CoverEditorCtxValue = {
  programActive: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  electron: any
  fabricRef: MutableRefObject<fabric.Canvas | null>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  canvasHostRef: MutableRefObject<HTMLDivElement | null>
  canvasBoundaryRef: MutableRefObject<HTMLDivElement | null>
  artboardFrameRef: MutableRefObject<HTMLDivElement | null>
  imagePickerRef: MutableRefObject<HTMLInputElement | null>
  backgroundImageIdRef: MutableRefObject<string | null>
  layers: InkLayer[]
  selectedLayerId: string | null
  setSelectedLayerId: (id: string | null) => void
  selectedObject: (fabric.Object & { inkideaLayerKind?: InkLayerKind }) | null
  busy: boolean
  error: string | null
  setError: (e: string | null) => void
  exportStatus: string
  batchProgress: number
  bgMode: 'color' | 'image' | 'transparent'
  setBgMode: (m: 'color' | 'image' | 'transparent') => void
  bgColor: string
  setBgColor: (c: string) => void
  bgOpacity: number
  setBgOpacity: (n: number) => void
  bgFillStyle: 'solid' | 'gradient'
  setBgFillStyle: (s: 'solid' | 'gradient') => void
  bgGradientFrom: string
  setBgGradientFrom: (c: string) => void
  bgGradientTo: string
  setBgGradientTo: (c: string) => void
  bgGradientDirection: 'vertical' | 'horizontal'
  setBgGradientDirection: (d: 'vertical' | 'horizontal') => void
  textValue: string
  setTextValue: (v: string) => void
  textFontSize: number
  setTextFontSize: (n: number) => void
  textFontFamily: string
  setTextFontFamily: (f: string) => void
  textFill: string
  setTextFill: (c: string) => void
  textOpacity: number
  setTextOpacity: (n: number) => void
  textAlign: 'left' | 'center' | 'right'
  setTextAlign: (a: 'left' | 'center' | 'right') => void
  strokeEnabled: boolean
  setStrokeEnabled: (b: boolean) => void
  strokeWidth: number
  setStrokeWidth: (n: number) => void
  strokeColor: string
  setStrokeColor: (c: string) => void
  textStrokeAlign: 'outside' | 'inside'
  setTextStrokeAlign: (a: 'outside' | 'inside') => void
  fillMode: 'solid' | 'gradient'
  setFillMode: (m: 'solid' | 'gradient') => void
  gradientFrom: string
  setGradientFrom: (c: string) => void
  gradientTo: string
  setGradientTo: (c: string) => void
  gradientDirection: 'vertical' | 'horizontal'
  setGradientDirection: (d: 'vertical' | 'horizontal') => void
  imageOpacity: number
  setImageOpacity: (n: number) => void
  shapeFill: string
  setShapeFill: (c: string) => void
  shapeStroke: string
  setShapeStroke: (c: string) => void
  shapeStrokeWidth: number
  setShapeStrokeWidth: (n: number) => void
  shapeOpacity: number
  setShapeOpacity: (n: number) => void
  layerAngleDeg: number
  setLayerAngleDeg: (n: number) => void
  templateMode: boolean
  setTemplateMode: (b: boolean) => void
  templateTitle: string
  setTemplateTitle: (s: string) => void
  templateEpisode: string
  setTemplateEpisode: (s: string) => void
  templateApplyDefaults: boolean
  setTemplateApplyDefaults: (b: boolean) => void
  templateCreditVisible: boolean
  setTemplateCreditVisible: (b: boolean) => void
  templateFontChoice: string
  setTemplateFontChoice: (s: string) => void
  localFontsSupported: boolean
  localFonts: string[]
  fontsBusy: boolean
  fontChoices: string[]
  viewZoomPercent: number
  setViewZoomPercent: (n: number) => void
  canHistoryUndo: boolean
  canHistoryRedo: boolean
  outputFormat: 'png' | 'jpg'
  setOutputFormat: (f: 'png' | 'jpg') => void
  quality: number
  setQuality: (n: number) => void
  batchStart: number
  setBatchStart: (n: number) => void
  batchEnd: number
  setBatchEnd: (n: number) => void
  batchLength: number
  setBatchLength: (n: number) => void
  batchPadding: number
  setBatchPadding: (n: number) => void
  batchOutputFolder: string
  setBatchOutputFolder: (s: string) => void
  syncLayers: () => void
  syncSelectionFromCanvas: () => void
  undoCanvas: () => Promise<void>
  redoCanvas: () => Promise<void>
  freeTransformActive: () => void
  applyLayerAngle: (deg: number) => void
  resetSelectedLayerTransform: () => void
  bringForwardSelected: () => void
  sendBackwardSelected: () => void
  resetView: () => void
  chooseTemplateCoverImageForCrop: () => Promise<string | null>
  chooseBackgroundImage: () => Promise<void>
  clearBackgroundImage: () => void
  loadTemplateCoverImage: () => Promise<void>
  loadTemplateCustomBackground: (dataUrl?: string) => Promise<void>
  loadTemplateCreditImage: (dataUrl?: string) => Promise<void>
  chooseFolder: (setter: (v: string) => void) => Promise<void>
  chooseAddImageLayer: () => Promise<void>
  addTextLayer: () => void
  addRectangleLayer: () => void
  addCircleLayer: () => void
  addNumberLayer: () => void
  deleteSelectedLayer: () => void
  ensureTemplateTextObjects: () => void
  ensureNumberLayer: () => string | null
  snapTemplateTitleAndEpisodeLayout: () => void
  clearTemplateObjects: () => void
  adjustments: LayerAdjustments
  updateAdjustments: (patch: Partial<LayerAdjustments>) => void
  resetAdjustments: () => void
  loadBackgroundImageFromDataUrl: (dataUrl: string) => Promise<void>
  loadTemplateCoverImageFromDataUrl: (dataUrl: string, sourceDataUrl?: string) => Promise<void>
  openCoverCropDialog: (kind: CoverCropKind, dataUrl: string, onConfirm: (dataUrl: string) => Promise<void>) => void
  exportSingle: () => Promise<void>
  exportBatch: () => Promise<void>
  addImageLayerFromDataUrl: (dataUrl: string) => Promise<void>
  saveCoverTemplate: () => Promise<void>
  loadCoverTemplate: () => Promise<void>
  loadCoverTemplateFromProject: () => Promise<void>
  revealCoverTemplateFolder: () => Promise<void>
}

export const CoverEditorContext = createContext<CoverEditorCtxValue | null>(null)

export function useCoverEditorCtx(): CoverEditorCtxValue {
  const ctx = useContext(CoverEditorContext)
  if (!ctx) throw new Error('useCoverEditorCtx must be used inside CoverEditor')
  return ctx
}
