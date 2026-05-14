/**
 * Pure-function tests for coverEditorUtils
 * — ไม่แตะ Fabric / DOM canvas; รัน fast บน happy-dom
 */

import { describe, expect, it } from 'vitest'
import {
  clamp,
  withDirSep,
  zeroPad,
  smartFormatEpisode,
  hexToRgba,
  newId,
  formatLoadError,
} from '../coverEditorUtils'

describe('clamp', () => {
  it('ค่าในช่วง คืนค่าเดิม', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })
  it('ต่ำกว่า min คืน min', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
  })
  it('สูงกว่า max คืน max', () => {
    expect(clamp(99, 0, 10)).toBe(10)
  })
  it('รองรับช่วงทศนิยม', () => {
    expect(clamp(0.7, 0, 1)).toBeCloseTo(0.7)
    expect(clamp(2, 0, 1)).toBe(1)
  })
})

describe('withDirSep', () => {
  it('เพิ่ม / ถ้าใช้ POSIX', () => {
    expect(withDirSep('/home/x')).toBe('/home/x/')
  })
  it('เพิ่ม \\ ถ้าใช้ Windows', () => {
    expect(withDirSep('C:\\foo')).toBe('C:\\foo\\')
  })
  it('ไม่เพิ่มถ้ามีอยู่แล้ว — POSIX', () => {
    expect(withDirSep('/home/x/')).toBe('/home/x/')
  })
  it('ไม่เพิ่มถ้ามีอยู่แล้ว — Windows', () => {
    expect(withDirSep('C:\\foo\\')).toBe('C:\\foo\\')
  })
  it('สตริงว่างคืนว่าง', () => {
    expect(withDirSep('')).toBe('')
  })
})

describe('zeroPad', () => {
  it('pad 1 เป็น "001"', () => {
    expect(zeroPad(1, 3)).toBe('001')
  })
  it('pad 50 เป็น "050"', () => {
    expect(zeroPad(50, 3)).toBe('050')
  })
  it('ตัวเลขยาวกว่า pad → ไม่ตัด', () => {
    expect(zeroPad(12345, 3)).toBe('12345')
  })
  it('places < 1 ถูก clamp เป็น 1', () => {
    expect(zeroPad(7, 0)).toBe('7')
  })
  it('ค่าลบ clamp เป็น 0', () => {
    expect(zeroPad(-5, 3)).toBe('000')
  })
})

describe('smartFormatEpisode', () => {
  it('single integer pad default 3', () => {
    expect(smartFormatEpisode('1')).toBe('001')
    expect(smartFormatEpisode('42')).toBe('042')
  })
  it('range a-b → AAA-BBB', () => {
    expect(smartFormatEpisode('1-50')).toBe('001-050')
    expect(smartFormatEpisode('1 - 50')).toBe('001-050')
  })
  it('range with en-dash / em-dash', () => {
    expect(smartFormatEpisode('1–50')).toBe('001-050')
    expect(smartFormatEpisode('1—50')).toBe('001-050')
  })
  it('range with "to" or "ถึง"', () => {
    expect(smartFormatEpisode('1 to 50')).toBe('001-050')
    expect(smartFormatEpisode('1 ถึง 50')).toBe('001-050')
  })
  it('range with ".."', () => {
    expect(smartFormatEpisode('1..50')).toBe('001-050')
  })
  it('strip prefix label เช่น "ตอน 5"', () => {
    expect(smartFormatEpisode('ตอน 5')).toBe('005')
  })
  it('custom pad parameter', () => {
    expect(smartFormatEpisode('7', 4)).toBe('0007')
  })
  it('ข้อความที่ไม่มีตัวเลข → คืน trimmed input', () => {
    expect(smartFormatEpisode('foo bar')).toBe('foo bar')
  })
  it('ช่องว่าง → คืน ""', () => {
    expect(smartFormatEpisode('   ')).toBe('')
    expect(smartFormatEpisode('')).toBe('')
  })
  it('null/undefined → ""', () => {
    expect(smartFormatEpisode(null as unknown as string)).toBe('')
    expect(smartFormatEpisode(undefined as unknown as string)).toBe('')
  })
})

describe('hexToRgba', () => {
  it('แปลง 6-digit hex', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255,0,0,1)')
    expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0,255,0,0.5)')
  })
  it('แปลง 3-digit hex', () => {
    expect(hexToRgba('#f00', 1)).toBe('rgba(255,0,0,1)')
    expect(hexToRgba('#0f0', 0.8)).toBe('rgba(0,255,0,0.8)')
  })
  it('hex ไม่มี # ก็ได้', () => {
    expect(hexToRgba('ff0000', 1)).toBe('rgba(255,0,0,1)')
  })
  it('clamp alpha 0..1', () => {
    expect(hexToRgba('#000', 2)).toBe('rgba(0,0,0,1)')
    expect(hexToRgba('#000', -1)).toBe('rgba(0,0,0,0)')
  })
  it('รับ rgb() string คืน rgba ที่ alpha ใหม่', () => {
    expect(hexToRgba('rgba(10,20,30,0.5)', 0.9)).toBe('rgba(10,20,30,0.9)')
  })
})

describe('newId', () => {
  it('คืน string ไม่ว่าง', () => {
    const id = newId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
  it('สอง call ติดกันได้ id ต่างกัน', () => {
    const a = newId()
    const b = newId()
    expect(a).not.toBe(b)
  })
})

describe('formatLoadError', () => {
  it('Error → message', () => {
    expect(formatLoadError(new Error('boom'))).toBe('boom')
  })
  it('string → คืนตรง ๆ', () => {
    expect(formatLoadError('plain')).toBe('plain')
  })
  it('object → JSON', () => {
    expect(formatLoadError({ a: 1 })).toBe('{"a":1}')
  })
  it('cycle object → fallback ภาษาไทย', () => {
    const o: Record<string, unknown> = {}
    o.self = o
    expect(formatLoadError(o)).toBe('เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ')
  })
})
