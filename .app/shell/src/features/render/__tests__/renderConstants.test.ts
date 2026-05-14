/**
 * Smoke tests for renderConstants — รับประกัน profile fix ที่ผู้ใช้ขอ
 */

import { describe, expect, it } from 'vitest'
import {
  FIXED_CRF,
  FIXED_ENCODE_OPTION,
  FIXED_FPS,
  FIXED_PRESET,
  FIXED_PROFILE_INFO,
  FIXED_RESOLUTION,
  INTRO_VIDEO_EXTENSIONS,
  LOG_BUFFER_LIMIT,
  STORAGE_KEY,
} from '../renderConstants'

describe('renderConstants — locked profile', () => {
  it('resolution = 144p', () => {
    expect(FIXED_RESOLUTION).toBe('144p')
  })
  it('encoder = Software H.264', () => {
    expect(FIXED_ENCODE_OPTION).toBe('Software (H.264)')
  })
  it('CRF = 51 (worst quality, smallest file)', () => {
    expect(FIXED_CRF).toBe(51)
  })
  it('fps = 1', () => {
    expect(FIXED_FPS).toBe(1)
  })
  it('preset = ultrafast', () => {
    expect(FIXED_PRESET).toBe('ultrafast')
  })
  it('FIXED_PROFILE_INFO อ้างถึง 144p + 1 fps + CRF 51', () => {
    expect(FIXED_PROFILE_INFO).toContain('144p')
    expect(FIXED_PROFILE_INFO).toContain('1 fps')
    expect(FIXED_PROFILE_INFO).toContain('CRF 51')
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
