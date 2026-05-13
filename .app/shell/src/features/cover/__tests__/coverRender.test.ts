import { describe, expect, it } from 'vitest'
import { formatChapterNumber, resolveChapterText } from '../coverRender'

describe('formatChapterNumber', () => {
  it('pads with zeros to the requested width', () => {
    expect(formatChapterNumber(1, 3)).toBe('001')
    expect(formatChapterNumber(7, 3)).toBe('007')
    expect(formatChapterNumber(42, 3)).toBe('042')
  })

  it('does not truncate when number is wider than padding', () => {
    expect(formatChapterNumber(1234, 2)).toBe('1234')
    expect(formatChapterNumber(99, 0)).toBe('99')
  })

  it('floors floating-point inputs', () => {
    expect(formatChapterNumber(3.9, 2)).toBe('03')
    expect(formatChapterNumber(10.4, 4)).toBe('0010')
  })

  it('clamps negatives to zero', () => {
    expect(formatChapterNumber(-5, 3)).toBe('000')
  })
})

describe('resolveChapterText', () => {
  it('replaces {n} with padded chapter number', () => {
    expect(resolveChapterText('ตอนที่ {n}', 7, 3)).toBe('ตอนที่ 007')
  })

  it('supports multiple {n} occurrences', () => {
    expect(resolveChapterText('EP{n} · บทที่ {n}', 12, 2)).toBe('EP12 · บทที่ 12')
  })

  it('returns template unchanged when no token present', () => {
    expect(resolveChapterText('ตอนพิเศษ', 5, 3)).toBe('ตอนพิเศษ')
  })

  it('handles empty template gracefully', () => {
    expect(resolveChapterText('', 1, 3)).toBe('')
  })
})
