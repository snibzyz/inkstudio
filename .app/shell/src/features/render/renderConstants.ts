/**
 * renderConstants — ค่าคงที่สำหรับ Render module
 *
 * Profile ของ INKSTUDIO: ภาพนิ่ง + เสียง → คลิป 360p · 1 fps · CRF 30 · Software H.264
 * ไม่มี toggle / machine preset / preset save — fix ค่าทั้งหมดเพื่อให้ทำงานเร็ว
 * และเล่นได้ทุกเครื่อง (ไม่ต้องพึ่ง GPU)
 */

export const STORAGE_KEY = 'inkstudio:render:options:v2'

export const LOG_BUFFER_LIMIT = 200

/**
 * บังคับโปรไฟล์ — ห้ามให้ user เปลี่ยน
 *
 * 144p (256×144) = ความละเอียดต่ำสุดที่ YouTube รองรับ
 * เลือกเพราะเป็นภาพนิ่ง + 1 fps → video stream เล็กมาก, encode เร็วสุด, ไฟล์เล็กสุด
 * (YouTube จะ re-encode เป็นทุก resolution ตอน upload อยู่แล้ว)
 *
 * CRF 51 = ค่าต่ำสุดที่ x264 รองรับ (แย่สุด เร็วสุด)
 * preset 'ultrafast' = ตัวเลือก speed สูงสุดของ x264 — ทรัพยากรน้อยที่สุด
 */
export const FIXED_RESOLUTION = '144p' as const
export const FIXED_ENCODE_OPTION = 'Software (H.264)' as const
export const FIXED_CRF = 51 as const
export const FIXED_FPS = 1 as const
export const FIXED_PRESET = 'ultrafast' as const

/** baseline ค่าคงที่ที่ backend ใช้ — แสดงเป็น hint ในแถบสถานะ */
export const FIXED_PROFILE_INFO = '144p · 1 fps · CRF 51 · ultrafast · AAC 96 kbps'

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
