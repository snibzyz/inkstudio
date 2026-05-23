/**
 * renderConstants — magic numbers + preset maps สำหรับ Render
 *
 * Default ต่ำสุด/ไวสุด เพราะ use case = นิยายเสียง (ภาพนิ่ง + เสียง, 1 fps)
 * คุณภาพภาพไม่กระทบเพราะภาพไม่ขยับ — user ยังปรับเองได้ผ่าน UI
 */

/** v2: บังคับให้ default ใหม่ (CRF 30 · 240p · ultrafast) มีผลกับ user ที่เคยใช้งานแล้ว
 *   v1 ถูกทิ้ง — custom presets ถูกโหลดใหม่จาก backend (`preset:list`) อยู่แล้ว ไม่กระทบ */
export const STORAGE_KEY = 'inkstudio:render:options:v2'

export const LOG_BUFFER_LIMIT = 200

export const CRF_MIN = 18
export const CRF_MAX = 30
export const DEFAULT_CRF = CRF_MAX
export const DEFAULT_RESOLUTION = '240p'
export const DEFAULT_ENCODE_OPTION = 'Software (H.264)'

export const RESOLUTION_OPTIONS = [
  { value: '240p', label: '240p', hint: 'ต่ำสุด · ภาพนิ่ง' },
  { value: '360p', label: '360p', hint: 'ต่ำ' },
  { value: '480p', label: '480p', hint: 'ประหยัด' },
  { value: '720p', label: '720p', hint: 'มาตรฐาน' },
  { value: '1080p', label: '1080p', hint: 'คมชัด' },
] as const

/** เรียงตามความเร็ว: เร็วสุด → ช้าสุด
 *  NVENC = Windows/Linux (การ์ดจอ NVIDIA) · VideoToolbox = macOS · Software = ทุกเครื่อง
 *  RenderEncodingSection กรองโดยใช้ผลของ render:diagnose-encoder — เฉพาะตัวที่
 *  probe ผ่านบนเครื่องเท่านั้นที่โผล่ใน dropdown (กัน user เลือกแล้ว render fail). */
export const ENCODE_OPTIONS = [
  { value: 'NVENC (H.264)', label: 'เร็วที่สุด — การ์ดจอ NVIDIA (H.264 · เข้ากันได้ทุกที่)' },
  { value: 'NVENC (H.265)', label: 'การ์ดจอ NVIDIA (H.265 · ไฟล์เล็กกว่า ~40%)' },
  { value: 'VideoToolbox (H.264)', label: 'เร็ว — ฮาร์ดแวร์ Mac (H.264)' },
  { value: 'VideoToolbox (H.265)', label: 'ฮาร์ดแวร์ Mac (H.265 · ไฟล์เล็กกว่า)' },
  { value: 'Software (H.264)', label: 'ช้าสุด — CPU (H.264 · ใช้ได้ทุกเครื่อง)' },
] as const

/** baseline ค่าคงที่ที่ backend ใช้ — แสดงเป็น hint เท่านั้น */
export const FIXED_AUDIO_INFO = '1 fps · AAC 192 kbps · 44.1 kHz · YUV420P'

/** mailto bug report — ใช้ใน hero meta */
export const BUG_REPORT_MAILTO =
  'mailto:?subject=' +
  encodeURIComponent('INKSTUDIO — รายงานบั๊ก') +
  '&body=' +
  encodeURIComponent(
    'กรุณาระบุ:\n- โปรแกรมที่ใช้ (เช่น เรนเดอร์วิดีโอ / ตัวช่วยปก)\n- ขั้นตอนที่ทำก่อนเกิดปัญหา\n- ข้อความ error (ถ้ามี)\n\n'
  )

/** นามสกุลไฟล์ที่ยอมรับเป็น intro clip */
export const INTRO_VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'webm', 'avi'] as const
