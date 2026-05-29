import { describe, expect, it } from 'vitest'
import { formatRenderSummary } from '../renderSummaryText'
import type { RenderSummary } from '../renderTypes'

const base: RenderSummary = {
  successCount: 5,
  totalFiles: 5,
  elapsedSeconds: 90,
  skippedCount: 0,
  missingCovers: [],
  encoder: 'Software (H.264)',
  resolutionLabel: '240p',
}
const opts = {
  projectName: 'นิยายเรื่องหนึ่ง',
  outputBasename: 'output/',
  formatSeconds: (s: number) => `${s}s`,
}

describe('formatRenderSummary — สำเร็จ', () => {
  it('ขึ้นต้น "เสร็จ:" + สถานะ "เรนเดอร์เสร็จสมบูรณ์"', () => {
    const r = formatRenderSummary(base, opts)
    expect(r.message.startsWith('เสร็จ: 5/5 ไฟล์')).toBe(true)
    expect(r.message).toContain('บันทึกใน นิยายเรื่องหนึ่ง ที่ output/')
    expect(r.status).toBe('เรนเดอร์เสร็จสมบูรณ์')
    expect(r.message).not.toContain('บันทึกบางส่วน')
  })
  it('เรียก formatSeconds กับ elapsedSeconds', () => {
    expect(formatRenderSummary(base, opts).message).toContain('· 90s ·')
  })
  it('missingCovers / skippedCount > 0 → เพิ่มบรรทัดสรุป', () => {
    const r = formatRenderSummary(
      { ...base, missingCovers: ['a.mp3', 'b.mp3'], skippedCount: 3 },
      opts
    )
    expect(r.message).toContain('ข้ามปก: 2 ไฟล์')
    expect(r.message).toContain('ข้ามซ้ำ: 3 ไฟล์')
  })
  it('ไม่มี missing/skip → ไม่มีบรรทัดเสริม', () => {
    const r = formatRenderSummary(base, opts)
    expect(r.message).not.toContain('ข้ามปก')
    expect(r.message).not.toContain('ข้ามซ้ำ')
  })
})

describe('formatRenderSummary — ยกเลิก', () => {
  it('cancelled=true → "ยกเลิก:" + บรรทัดบันทึกบางส่วน + สถานะ "ยกเลิกการเรนเดอร์แล้ว"', () => {
    const r = formatRenderSummary({ ...base, successCount: 2, cancelled: true }, opts)
    expect(r.message.startsWith('ยกเลิก: 2/5 ไฟล์')).toBe(true)
    expect(r.message).toContain('ไฟล์ที่กำลังเรนเดอร์อยู่ถูกบันทึกบางส่วน (เปิดดูได้)')
    expect(r.status).toBe('ยกเลิกการเรนเดอร์แล้ว')
  })
  it('cancelled ยังรวมบรรทัด missing/skip ได้', () => {
    const r = formatRenderSummary(
      { ...base, cancelled: true, missingCovers: ['x'], skippedCount: 1 },
      opts
    )
    expect(r.message).toContain('ข้ามปก: 1 ไฟล์')
    expect(r.message).toContain('ข้ามซ้ำ: 1 ไฟล์')
    expect(r.message).toContain('บันทึกบางส่วน')
  })
})
