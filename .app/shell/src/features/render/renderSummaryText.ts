/**
 * renderSummaryText — สร้างข้อความสรุป + สถานะหลังเรนเดอร์ (pure → unit-testable)
 *
 * แยกออกจาก useRenderJob เพื่อเทสได้ตรง ๆ — logic เดียวกับ INKIDEA:
 *   - cancelled=true  → verb "ยกเลิก" + บรรทัด "บันทึกบางส่วน" + สถานะ "ยกเลิกการเรนเดอร์แล้ว"
 *   - cancelled=false → verb "เสร็จ" + สถานะ "เรนเดอร์เสร็จสมบูรณ์"
 */

import type { RenderSummary } from './renderTypes'

export interface RenderSummaryTextOpts {
  projectName: string
  /** ชื่อโฟลเดอร์ปลายทาง (มี '/' ต่อท้ายแล้ว) */
  outputBasename: string
  formatSeconds: (s: number) => string
}

export interface RenderSummaryText {
  message: string
  status: string
}

export function formatRenderSummary(
  summary: RenderSummary,
  { projectName, outputBasename, formatSeconds }: RenderSummaryTextOpts
): RenderSummaryText {
  const verb = summary.cancelled ? 'ยกเลิก' : 'เสร็จ'
  let message =
    `${verb}: ${summary.successCount}/${summary.totalFiles} ไฟล์ · ` +
    `${formatSeconds(summary.elapsedSeconds)} · บันทึกใน ${projectName} ที่ ${outputBasename}`
  if (summary.missingCovers.length > 0) message += `\nข้ามปก: ${summary.missingCovers.length} ไฟล์`
  if (summary.skippedCount > 0) message += `\nข้ามซ้ำ: ${summary.skippedCount} ไฟล์`
  if (summary.cancelled) message += '\nไฟล์ที่กำลังเรนเดอร์อยู่ถูกบันทึกบางส่วน (เปิดดูได้)'
  return {
    message,
    status: summary.cancelled ? 'ยกเลิกการเรนเดอร์แล้ว' : 'เรนเดอร์เสร็จสมบูรณ์',
  }
}
