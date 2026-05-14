import type * as fabric from 'fabric'

export const INK_SERIALIZE_PROPS = [
  'inkideaLayerId',
  'inkideaLayerKind',
  'inkideaLayerLabel',
  'inkideaGradientFrom',
  'inkideaGradientTo',
  'inkideaGradientDirection',
  'inkideaDefaultLeft',
  'inkideaDefaultTop',
  'inkideaDefaultAngle',
  'inkideaDefaultScaleX',
  'inkideaDefaultScaleY',
  'inkideaDefaultSkewX',
  'inkideaDefaultSkewY',
  'inkideaDefaultOriginX',
  'inkideaDefaultOriginY',
  'inkideaAdjustments',
  'globalCompositeOperation',
] as const

export type InkBlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'

export type LayerAdjustments = {
  blur: number          // 0..1 (fabric Blur filter scale)
  brightness: number    // -1..1
  contrast: number      // -1..1
  saturation: number    // -1..1
  hue: number           // -1..1 (rotation, fabric scale)
  overlayAlpha: number  // 0..1
  overlayColor: string  // hex color
  shadowBlur: number    // px (for non-image visible blur via shadow)
  shadowColor: string   // shadow color
  blendMode: InkBlendMode
}

export const DEFAULT_LAYER_ADJUSTMENTS: LayerAdjustments = {
  blur: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  overlayAlpha: 0,
  overlayColor: '#000000',
  shadowBlur: 0,
  shadowColor: '#000000',
  blendMode: 'source-over',
}

// Conservative default — fabric.filters.Blur uses `blur * dimension` as kernel size,
// so values above ~0.2 produce huge convolutions that render as a solid black frame.
export const TEMPLATE_BG_DEFAULT_ADJUSTMENTS: LayerAdjustments = {
  ...DEFAULT_LAYER_ADJUSTMENTS,
  blur: 0.1,
  brightness: -0.15,
  saturation: 0.05,
  overlayAlpha: 0.22,
}

export const BLEND_MODE_OPTIONS: { value: InkBlendMode; label: string }[] = [
  { value: 'source-over', label: 'ปกติ' },
  { value: 'multiply', label: 'คูณ (Multiply)' },
  { value: 'screen', label: 'สกรีน (Screen)' },
  { value: 'overlay', label: 'ซ้อนทับ (Overlay)' },
  { value: 'soft-light', label: 'แสงนุ่ม' },
  { value: 'hard-light', label: 'แสงแข็ง' },
  { value: 'darken', label: 'ทำให้เข้ม' },
  { value: 'lighten', label: 'ทำให้สว่าง' },
  { value: 'color-dodge', label: 'หลบสี' },
  { value: 'color-burn', label: 'เผาสี' },
  { value: 'difference', label: 'ผลต่าง' },
  { value: 'exclusion', label: 'ตัดออก' },
]

export type InkLayerKind = 'background' | 'text' | 'image' | 'shape'

export type InkLayer = {
  id: string
  kind: InkLayerKind
  label: string
  visible: boolean
}

export type LocalFontData = {
  family: string
  fullName?: string
  postscriptName?: string
}

export const COVER_RATIO_PRESETS = [
  { id: 'novel-portrait', label: 'ปกนิยาย 3:4', width: 3, height: 4 },
  { id: 'book-portrait', label: 'หนังสือ 2:3', width: 2, height: 3 },
  { id: 'widescreen', label: 'พื้นหลัง 16:9', width: 16, height: 9 },
  { id: 'credit-strip', label: 'เครดิต 3:1', width: 3, height: 1 },
  { id: 'square', label: 'จัตุรัส 1:1', width: 1, height: 1 },
  { id: 'custom', label: 'กำหนดเอง', width: 3, height: 4 },
] as const

export const DEFAULT_COVER_RATIO_PRESET = COVER_RATIO_PRESETS[0]
export const DEFAULT_BACKGROUND_RATIO_PRESET = COVER_RATIO_PRESETS[2]
export const DEFAULT_CREDIT_RATIO_PRESET = COVER_RATIO_PRESETS[3]
export const CANVAS_W = 1280
export const CANVAS_H = 720

export const TEMPLATE_TEXT_CENTER_X = CANVAS_W / 2
export const TEMPLATE_TITLE_TOP = CANVAS_H * 0.26
export const TEMPLATE_EPISODE_TOP = CANVAS_H * 0.66
export const TEMPLATE_TITLE_WIDTH = CANVAS_W * 0.52
export const TEMPLATE_EPISODE_WIDTH = CANVAS_W * 0.52

export type TemplateBgBlurOpts = {
  blurPx: number
  brightness: number
  saturate: number
  overlayAlpha: number
}

export type InkideaTransformDefaults = {
  inkideaDefaultLeft?: number
  inkideaDefaultTop?: number
  inkideaDefaultAngle?: number
  inkideaDefaultScaleX?: number
  inkideaDefaultScaleY?: number
  inkideaDefaultSkewX?: number
  inkideaDefaultSkewY?: number
  inkideaDefaultOriginX?: fabric.TOriginX
  inkideaDefaultOriginY?: fabric.TOriginY
}

export type CoverEditorProps = {
  programActive?: boolean
}
