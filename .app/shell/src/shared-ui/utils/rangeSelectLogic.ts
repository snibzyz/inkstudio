/**
 * rangeSelectLogic — เลือกไฟล์เป็นช่วงตอนจากชื่อไฟล์ + batch mode
 *
 * ใช้ร่วมกันใน RenderTab (คลิป), AudioTab (เสียง), Explorer
 *
 * Concepts:
 *   chapter — เลขตอนที่ parse จากชื่อไฟล์ (run แรกของตัวเลขในชื่อ ตัด extension ออกก่อน)
 *   range   — "1-50, 100-200, 300" → ช่วงตัวเลข
 *   batch   — กดที่ตอน N + batchSize K → เลือกตอน N ถึง N+K-1 (ที่มีในลิสต์)
 */

export interface RangeItem {
  id: string
  /** เลขตอนที่ parse ได้จากชื่อไฟล์ (null = ชื่อไม่มีตัวเลข) */
  chapter: number | null
}

export interface ParsedRange {
  start: number
  end: number
}

/**
 * Parse "เลขตอน" จากชื่อไฟล์ — ตัวเลขชุดแรกในชื่อ (หลังตัด extension)
 *   "001.txt"          → 1
 *   "012 ชื่อบท.txt"   → 12
 *   "บท 5.txt"         → 5
 *   "chapter-7.md"     → 7
 *   "abc.txt"          → null
 *   "video-1080p.mp4"  → 1080 (extension ตัดก่อน แล้วเจอ "1080" run แรก)
 */
export function parseChapterNumber(filename: string): number | null {
  if (!filename) return null
  const base = filename.replace(/\.[a-z0-9]{1,5}$/i, '')
  const match = base.match(/\d+/)
  if (!match) return null
  const n = parseInt(match[0], 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse range text — "1-50, 100-200, 300" → list ของ {start,end}
 *   ตัวคั่น: ',' ';' (whitespace ระหว่าง token ตัดทิ้ง)
 *   "50-1" → swap เป็น 1-50 อัตโนมัติ
 *   "300"  → ช่วงเดียว 300-300
 *   token ที่ parse ไม่ได้ → ข้าม
 */
export function parseRangeInput(input: string): ParsedRange[] {
  if (!input || !input.trim()) return []
  const tokens = input.split(/[,;]+/).map((t) => t.trim()).filter(Boolean)
  const out: ParsedRange[] = []
  for (const tok of tokens) {
    const range = tok.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const a = parseInt(range[1] ?? '', 10)
      const b = parseInt(range[2] ?? '', 10)
      if (Number.isFinite(a) && Number.isFinite(b)) {
        out.push({ start: Math.min(a, b), end: Math.max(a, b) })
      }
      continue
    }
    const single = parseInt(tok, 10)
    if (Number.isFinite(single)) out.push({ start: single, end: single })
  }
  return out
}

/** ไอเทมที่ chapter ตกในช่วงใด ๆ ของ range input → Set<id> */
export function selectionFromRange(input: string, items: ReadonlyArray<RangeItem>): Set<string> {
  const ranges = parseRangeInput(input)
  if (ranges.length === 0) return new Set()
  const out = new Set<string>()
  for (const item of items) {
    if (item.chapter == null) continue
    const ch = item.chapter
    if (ranges.some((r) => ch >= r.start && ch <= r.end)) out.add(item.id)
  }
  return out
}

/**
 * Batch select จากคลิก — กดที่ id ใด + batchSize K → เลือก K ตอนต่อจากตอนที่กด
 *
 * ใช้ chapter เป็นหลัก:
 *   คลิกตอน 11 + K=10 → เลือก chapter 11..20 (เฉพาะที่มีในลิสต์)
 *
 * Fallback (ไม่มี chapter): ใช้ index — เลือก K ไอเทมต่อกันจาก clickedIdx
 */
export function batchSelectionFromClick(
  clickedId: string,
  batchSize: number,
  items: ReadonlyArray<RangeItem>
): Set<string> {
  const out = new Set<string>()
  if (!batchSize || batchSize < 1) return out
  const idx = items.findIndex((i) => i.id === clickedId)
  if (idx < 0) return out

  const clicked = items[idx]!
  if (clicked.chapter != null) {
    const startCh = clicked.chapter
    const endCh = startCh + batchSize - 1
    for (const item of items) {
      if (item.chapter == null) continue
      if (item.chapter >= startCh && item.chapter <= endCh) out.add(item.id)
    }
    return out
  }
  for (let i = idx; i < Math.min(items.length, idx + batchSize); i += 1) {
    out.add(items[i]!.id)
  }
  return out
}

/**
 * Toggle batch — คลิกซ้ำ batch เดิม = unselect ทั้ง batch
 *   ถ้าทุก id ใน batch อยู่ใน selection แล้ว → ลบทั้งหมด
 *   ไม่งั้น → เพิ่มทั้งหมด
 */
export function toggleBatchSelection(
  clickedId: string,
  batchSize: number,
  items: ReadonlyArray<RangeItem>,
  currentSelection: ReadonlySet<string>
): Set<string> {
  const batch = batchSelectionFromClick(clickedId, batchSize, items)
  const next = new Set(currentSelection)
  if (batch.size === 0) return next
  const allSelected = Array.from(batch).every((id) => currentSelection.has(id))
  if (allSelected) {
    for (const id of batch) next.delete(id)
  } else {
    for (const id of batch) next.add(id)
  }
  return next
}

/** Helper: แปลง array ชื่อไฟล์เป็น RangeItem[] (id = filename, chapter จาก parse) */
export function toRangeItemsFromFilenames(files: ReadonlyArray<string>): RangeItem[] {
  return files.map((name) => ({ id: name, chapter: parseChapterNumber(name) }))
}
