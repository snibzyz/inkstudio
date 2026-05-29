import { describe, expect, it } from 'vitest'
import { reconcileAudioSelection } from '../renderAudioSelection'

describe('reconcileAudioSelection', () => {
  const files = ['001.mp3', '002.mp3', '003.mp3']

  it('prev ว่าง → เลือกทั้งหมด (โหลดรายการครั้งแรก)', () => {
    expect(reconcileAudioSelection(new Set(), files)).toEqual(new Set(files))
  })

  it('คงเฉพาะที่ยังมีอยู่ในรายการใหม่ (ไฟล์บางอันหายไป)', () => {
    const prev = new Set(['001.mp3', '999.mp3']) // 999 ถูกลบไปแล้ว
    expect(reconcileAudioSelection(prev, files)).toEqual(new Set(['001.mp3']))
  })

  it('ที่เคยเลือกหายหมด → เลือกทั้งหมด (กันสถานะไม่ได้เลือกอะไร)', () => {
    const prev = new Set(['x.mp3', 'y.mp3']) // ไม่มีในรายการใหม่เลย
    expect(reconcileAudioSelection(prev, files)).toEqual(new Set(files))
  })

  it('ไฟล์ใหม่ที่เพิ่งเพิ่ม จะไม่ถูกเลือกอัตโนมัติถ้าเคยมี selection อยู่แล้ว', () => {
    const prev = new Set(['001.mp3'])
    const withNew = [...files, '004.mp3']
    // คง 001 ที่เลือกไว้ — 004 (ใหม่) ไม่ถูกเพิ่มเพราะ prev ไม่ว่าง
    expect(reconcileAudioSelection(prev, withNew)).toEqual(new Set(['001.mp3']))
  })

  it('รายการใหม่ว่าง + prev ว่าง → ว่าง', () => {
    expect(reconcileAudioSelection(new Set(), [])).toEqual(new Set())
  })

  it('รายการใหม่ว่าง + prev มีของ → ว่าง (ไม่มีอะไรให้คง/เลือก)', () => {
    expect(reconcileAudioSelection(new Set(['001.mp3']), [])).toEqual(new Set())
  })
})
