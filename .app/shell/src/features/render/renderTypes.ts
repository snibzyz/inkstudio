/**
 * renderTypes — TypeScript types สำหรับโมดูล Render
 *   - ProgressPayload: payload จาก render:progress event
 *   - RenderSummary: สรุปผลตอนเรนเดอร์เสร็จ
 *   - PersistedRenderOptions: state ที่ persist ลง localStorage
 *
 * Note: INKSTUDIO ตัด machine preset / encoding options / batch preset ออก —
 *       profile ถูก fix ที่ 360p · 1 fps · CRF 30 · Software H.264
 */

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

export type FilesEntry = {
  fileName: string
  selected: boolean
}

/** ข้อมูลที่ persist ใน localStorage */
export type PersistedRenderOptions = {
  /** path ของ intro clip ล่าสุดที่ user เลือก — จำไว้ให้ครั้งหน้า */
  introClipPath?: string
}
