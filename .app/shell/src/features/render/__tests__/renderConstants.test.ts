/**
 * Smoke tests for renderConstants — INKIDEA shape (ports from INKIDEA)
 *   - encoder dropdown options + resolution options + CRF range
 *   - storage key uses inkstudio: prefix
 */

import { describe, expect, it } from 'vitest'
import {
  CRF_MAX,
  CRF_MIN,
  DEFAULT_CRF,
  DEFAULT_ENCODE_OPTION,
  DEFAULT_RESOLUTION,
  ENCODE_OPTIONS,
  FIXED_AUDIO_INFO,
  INTRO_VIDEO_EXTENSIONS,
  LOG_BUFFER_LIMIT,
  RESOLUTION_OPTIONS,
  STORAGE_KEY,
} from '../renderConstants'

describe('renderConstants — defaults', () => {
  it('default encoder = Software H.264', () => {
    expect(DEFAULT_ENCODE_OPTION).toBe('Software (H.264)')
  })
  it('default CRF = CRF_MAX', () => {
    expect(DEFAULT_CRF).toBe(CRF_MAX)
  })
  it('CRF range sensible (CRF_MIN < CRF_MAX)', () => {
    expect(CRF_MIN).toBeLessThan(CRF_MAX)
  })
  it('default resolution = 240p', () => {
    expect(DEFAULT_RESOLUTION).toBe('240p')
  })
  it('FIXED_AUDIO_INFO อ้างถึง 1 fps + AAC', () => {
    expect(FIXED_AUDIO_INFO).toContain('1 fps')
    expect(FIXED_AUDIO_INFO.toLowerCase()).toContain('aac')
  })
})

describe('renderConstants — options arrays', () => {
  it('ENCODE_OPTIONS มี Software H.264', () => {
    expect(ENCODE_OPTIONS.some((o) => o.value === 'Software (H.264)')).toBe(true)
  })
  it('ENCODE_OPTIONS มี NVENC H.264', () => {
    expect(ENCODE_OPTIONS.some((o) => o.value === 'NVENC (H.264)')).toBe(true)
  })
  it('RESOLUTION_OPTIONS รวม 240p ถึง 1080p', () => {
    const values = RESOLUTION_OPTIONS.map((r) => r.value)
    expect(values).toContain('240p')
    expect(values).toContain('1080p')
  })
})

describe('renderConstants — misc', () => {
  it('LOG_BUFFER_LIMIT > 0', () => {
    expect(LOG_BUFFER_LIMIT).toBeGreaterThan(0)
  })
  it('STORAGE_KEY prefix inkstudio', () => {
    expect(STORAGE_KEY.startsWith('inkstudio:')).toBe(true)
  })
  it('INTRO_VIDEO_EXTENSIONS includes mp4 + mov', () => {
    expect(INTRO_VIDEO_EXTENSIONS).toContain('mp4')
    expect(INTRO_VIDEO_EXTENSIONS).toContain('mov')
  })
})
