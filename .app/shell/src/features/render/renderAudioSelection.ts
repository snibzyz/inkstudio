/**
 * renderAudioSelection — กติกาคงการเลือกไฟล์เสียงเมื่อรายการตอนถูกโหลดใหม่ (pure)
 *
 * ใช้ตอน refreshAudioPreview (รวมถึงตอนกลับเข้าโหมดคลิป — รายการอาจมีไฟล์ใหม่/หายไป):
 *   - ยังไม่เคยเลือกอะไร (prev ว่าง)      → เลือกทั้งหมด
 *   - เคยเลือกไว้                          → คงเฉพาะที่ยังมีอยู่ในรายการใหม่
 *   - ที่เคยเลือกหายไปหมด (เหลือ 0)         → เลือกทั้งหมด (กันสถานะ "ไม่ได้เลือกอะไรเลย")
 */
export function reconcileAudioSelection(
  prev: ReadonlySet<string>,
  files: readonly string[]
): Set<string> {
  const next = new Set<string>()
  if (prev.size === 0) {
    for (const f of files) next.add(f)
    return next
  }
  const allowed = new Set(files)
  for (const f of prev) if (allowed.has(f)) next.add(f)
  if (next.size === 0) for (const f of files) next.add(f)
  return next
}
