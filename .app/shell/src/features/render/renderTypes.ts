/**
 * renderTypes — TypeScript types สำหรับโมดูล Render
 *   - BatchPreset: ชุด config ที่ผู้ใช้บันทึก/โหลดเป็น preset
 *   - ProgressPayload: payload จาก render:* progress event
 *   - RenderSummary: สรุปผลตอนเรนเดอร์เสร็จ
 */

export type PresetMap = Record<string, BatchPreset>

export type BatchPreset = {
  image_path: string
  audio_folder: string
  output_folder: string
  cover_folder: string
  use_multiple_covers: boolean
  title_prefix: string
  encode_option: string
  crf_value: number
  resolution: string
}

export type ProgressPayload = {
  jobId: string
  phase: string
  progress: number
  message?: string
  fileName?: string
  fileProgressPercent?: number
  overallPercent?: number
  currentTimeText?: string
  durationText?: string
  etaText?: string
  summary?: RenderSummary
}

export type RenderSummary = {
  successCount: number
  totalFiles: number
  elapsedSeconds: number
  skippedCount: number
  missingCovers: string[]
  encoder: string
  resolutionLabel: string
}

export type EncodeOptionValue =
  | 'NVENC (H.264)'
  | 'NVENC (H.265)'
  | 'VideoToolbox (H.264)'
  | 'VideoToolbox (H.265)'
  | 'Software (H.264)'
  | 'NVIDIA NVENC (H.264)'

export type ResolutionValue = '240p' | '360p' | '480p' | '720p' | '1080p'

export type FilesEntry = {
  fileName: string
  selected: boolean
}

/** ข้อมูลที่ persist ใน localStorage (key inkstudio:render:options:v2) */
export type PersistedRenderOptions = {
  encodeOption: string
  /** user เปลี่ยน encoder เองหรือยัง — false = ระบบ auto-detect ใหม่ได้ทุกครั้งที่ mount
   *  true = ใช้ค่าที่ user เลือก ไม่แก้ทับ */
  encoderUserSet?: boolean
  crfValue: number
  resolution: string
  /** path ของวิดีโอ intro ที่ user เลือกล่าสุด (จำข้ามเซสชัน) */
  introPath?: string
  /** เปิด/ปิดการแทรก intro */
  useIntro?: boolean
  presets?: PresetMap
}
