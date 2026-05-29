import { describe, expect, it } from 'vitest'
// pure auto-update helpers (CommonJS) — ใช้ทั้ง win (electron-updater) flow และ
// mac custom updater. import แบบ default แล้ว destructure เพื่อความเข้ากันได้ CJS interop
import pkg from '../updateVersion.cjs'
const { compareSemver, parseFileUrls, pickArchZip } = pkg as {
  compareSemver: (a: string, b: string) => number
  parseFileUrls: (text: string) => string[]
  pickArchZip: (urls: string[], arch: string) => string | null
}

describe('compareSemver — ตัดสินว่ามีอัพเดต', () => {
  it('latest ใหม่กว่า current → 1 (มีอัพเดต)', () => {
    expect(compareSemver('0.1.1', '0.1.0')).toBe(1)
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1)
  })
  it('เท่ากัน → 0 (ไม่อัพเดต)', () => {
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0)
  })
  it('เก่ากว่า → -1 (ไม่อัพเดต/อย่า downgrade)', () => {
    expect(compareSemver('0.1.0', '0.2.0')).toBe(-1)
  })
  it('เทียบเป็นตัวเลข ไม่ใช่ string: 0.1.10 > 0.1.9', () => {
    expect(compareSemver('0.1.10', '0.1.9')).toBe(1)
  })
  it('ความยาวต่างกัน: 1.2 vs 1.2.0 = เท่ากัน, 1.2.1 > 1.2', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
    expect(compareSemver('1.2.1', '1.2')).toBe(1)
  })
})

const SAMPLE_MAC_YML = `version: 0.1.0
files:
  - url: INKSTUDIO-0.1.0-arm64.zip
    sha512: AAAA==
    size: 111
  - url: INKSTUDIO-0.1.0-arm64.zip.blockmap
    sha512: BBBB==
    size: 22
  - url: INKSTUDIO-0.1.0-x64.zip
    sha512: CCCC==
    size: 222
path: INKSTUDIO-0.1.0-arm64.zip
sha512: AAAA==
releaseDate: '2026-05-30T00:00:00.000Z'
`

describe('parseFileUrls — อ่าน latest-mac.yml', () => {
  it('ดึง url ทุกบรรทัดใต้ files: (รวม blockmap)', () => {
    expect(parseFileUrls(SAMPLE_MAC_YML)).toEqual([
      'INKSTUDIO-0.1.0-arm64.zip',
      'INKSTUDIO-0.1.0-arm64.zip.blockmap',
      'INKSTUDIO-0.1.0-x64.zip',
    ])
  })
  it('ไม่มี section files: → []', () => {
    expect(parseFileUrls('version: 0.1.0\npath: x.zip\n')).toEqual([])
  })
  it('หยุดที่ key ระดับบนถัดไป (path:) ไม่กิน url อื่น', () => {
    expect(parseFileUrls(SAMPLE_MAC_YML)).not.toContain('INKSTUDIO-0.1.0-arm64.zip\n')
  })
})

describe('pickArchZip — เลือก zip ตาม arch (กันได้ build ผิดสถาปัตยกรรม)', () => {
  const urls = parseFileUrls(SAMPLE_MAC_YML)
  it('arm64 → เลือก arm64 zip (ไม่ใช่ blockmap)', () => {
    expect(pickArchZip(urls, 'arm64')).toBe('INKSTUDIO-0.1.0-arm64.zip')
  })
  it('x64 → เลือก x64 zip', () => {
    expect(pickArchZip(urls, 'x64')).toBe('INKSTUDIO-0.1.0-x64.zip')
  })
  it('ไม่มี zip ตรง arch → null', () => {
    expect(pickArchZip(['INKSTUDIO-0.1.0-arm64.zip'], 'x64')).toBeNull()
  })
  it('ไม่เลือกไฟล์ .blockmap แม้ชื่อ arch ตรง', () => {
    expect(pickArchZip(['INKSTUDIO-0.1.0-arm64.zip.blockmap'], 'arm64')).toBeNull()
  })
})
