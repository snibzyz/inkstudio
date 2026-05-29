import { describe, it, expect } from 'vitest'
import {
  parseChapterNumber,
  parseRangeInput,
  selectionFromRange,
  batchSelectionFromClick,
  toggleBatchSelection,
  toRangeItemsFromFilenames,
  type RangeItem,
} from '../rangeSelectLogic'

describe('parseChapterNumber', () => {
  it('parses the first numeric run after stripping extension', () => {
    expect(parseChapterNumber('001.txt')).toBe(1)
    expect(parseChapterNumber('012 ชื่อบท.txt')).toBe(12)
    expect(parseChapterNumber('บท 5.txt')).toBe(5)
    expect(parseChapterNumber('chapter-7.md')).toBe(7)
  })

  it('strips the extension before matching (1080p edge case)', () => {
    expect(parseChapterNumber('video-1080p.mp4')).toBe(1080)
  })

  it('returns null when no digits or empty', () => {
    expect(parseChapterNumber('abc.txt')).toBeNull()
    expect(parseChapterNumber('')).toBeNull()
  })
})

describe('parseRangeInput', () => {
  it('parses comma/semicolon separated ranges and singles', () => {
    expect(parseRangeInput('1-50, 100-200, 300')).toEqual([
      { start: 1, end: 50 },
      { start: 100, end: 200 },
      { start: 300, end: 300 },
    ])
    expect(parseRangeInput('1;2;3')).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ])
  })

  it('swaps reversed ranges', () => {
    expect(parseRangeInput('50-1')).toEqual([{ start: 1, end: 50 }])
  })

  it('skips unparseable tokens and handles empty input', () => {
    expect(parseRangeInput('1-50, abc, 3')).toEqual([
      { start: 1, end: 50 },
      { start: 3, end: 3 },
    ])
    expect(parseRangeInput('')).toEqual([])
    expect(parseRangeInput('   ')).toEqual([])
  })
})

describe('selectionFromRange', () => {
  const items: RangeItem[] = [
    { id: 'a', chapter: 1 },
    { id: 'b', chapter: 25 },
    { id: 'c', chapter: 51 },
    { id: 'd', chapter: null },
    { id: 'e', chapter: 150 },
  ]

  it('selects items whose chapter falls in any range', () => {
    expect(selectionFromRange('1-50, 100-200', items)).toEqual(new Set(['a', 'b', 'e']))
  })

  it('ignores items without a chapter', () => {
    expect(selectionFromRange('1-1000', items).has('d')).toBe(false)
  })

  it('returns empty set for empty/invalid input', () => {
    expect(selectionFromRange('', items)).toEqual(new Set())
    expect(selectionFromRange('xyz', items)).toEqual(new Set())
  })
})

describe('batchSelectionFromClick', () => {
  const items: RangeItem[] = [
    { id: 'ch11', chapter: 11 },
    { id: 'ch12', chapter: 12 },
    { id: 'ch13', chapter: 13 },
    { id: 'ch20', chapter: 20 },
    { id: 'ch21', chapter: 21 },
  ]

  it('selects K chapters starting from the clicked chapter', () => {
    // click ch11 + size 10 → chapters 11..20 present in list
    expect(batchSelectionFromClick('ch11', 10, items)).toEqual(
      new Set(['ch11', 'ch12', 'ch13', 'ch20'])
    )
  })

  it('falls back to index-based when chapter is null', () => {
    const noNum: RangeItem[] = [
      { id: 'x', chapter: null },
      { id: 'y', chapter: null },
      { id: 'z', chapter: null },
    ]
    expect(batchSelectionFromClick('x', 2, noNum)).toEqual(new Set(['x', 'y']))
  })

  it('returns empty for invalid batchSize or missing id', () => {
    expect(batchSelectionFromClick('ch11', 0, items)).toEqual(new Set())
    expect(batchSelectionFromClick('nope', 10, items)).toEqual(new Set())
  })
})

describe('toggleBatchSelection', () => {
  const items: RangeItem[] = [
    { id: 'ch1', chapter: 1 },
    { id: 'ch2', chapter: 2 },
    { id: 'ch3', chapter: 3 },
  ]

  it('adds the whole batch when not all selected', () => {
    const next = toggleBatchSelection('ch1', 3, items, new Set(['ch1']))
    expect(next).toEqual(new Set(['ch1', 'ch2', 'ch3']))
  })

  it('removes the whole batch when all already selected', () => {
    const next = toggleBatchSelection('ch1', 3, items, new Set(['ch1', 'ch2', 'ch3']))
    expect(next).toEqual(new Set())
  })

  it('returns current selection unchanged when batch is empty', () => {
    const cur = new Set(['ch2'])
    expect(toggleBatchSelection('missing', 3, items, cur)).toEqual(cur)
  })
})

describe('toRangeItemsFromFilenames', () => {
  it('maps filenames to id + parsed chapter', () => {
    expect(toRangeItemsFromFilenames(['001.wav', 'no-num.mp3'])).toEqual([
      { id: '001.wav', chapter: 1 },
      { id: 'no-num.mp3', chapter: null },
    ])
  })
})
