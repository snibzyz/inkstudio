/**
 * findMatchingCoverSync — unit test
 *
 * รัน: node --test electron/__tests__/findMatchingCover.test.cjs
 */

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

const { findMatchingCoverSync } = require('../ipc/renderHelpers.cjs')

function makeReaddir(entries) {
  return () => entries
}

test('match ที่ชื่อตรงกัน (ไม่นับ ext)', () => {
  const readdir = makeReaddir(['001.png', '002.png', 'cover.jpg'])
  const r = findMatchingCoverSync('C:/covers', '001.m4a', readdir)
  assert.strictEqual(r, path.join('C:/covers', '001.png'))
})

test('case-insensitive', () => {
  const readdir = makeReaddir(['Chapter-A.PNG'])
  const r = findMatchingCoverSync('C:/c', 'chapter-a.mp3', readdir)
  assert.strictEqual(r, path.join('C:/c', 'Chapter-A.PNG'))
})

test('รองรับ ext png/jpg/jpeg/webp', () => {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const readdir = makeReaddir([`x.${ext}`])
    const r = findMatchingCoverSync('C:/c', 'x.mp3', readdir)
    assert.strictEqual(r, path.join('C:/c', `x.${ext}`))
  }
})

test('ข้ามไฟล์ที่ไม่ใช่รูป', () => {
  const readdir = makeReaddir(['001.txt', '001.md'])
  const r = findMatchingCoverSync('C:/c', '001.mp3', readdir)
  assert.strictEqual(r, null)
})

test('คืน null ถ้าไม่เจอ', () => {
  const readdir = makeReaddir(['other.png'])
  const r = findMatchingCoverSync('C:/c', 'missing.mp3', readdir)
  assert.strictEqual(r, null)
})

test('คืน null ถ้า coverFolder ว่าง / audioBase ว่าง', () => {
  assert.strictEqual(findMatchingCoverSync('', 'a.mp3', () => []), null)
  assert.strictEqual(findMatchingCoverSync('C:/c', '', () => []), null)
})

test('คืน null ถ้า readdir throw (folder ไม่มีอยู่)', () => {
  const readdir = () => { throw new Error('ENOENT') }
  const r = findMatchingCoverSync('C:/missing', 'a.mp3', readdir)
  assert.strictEqual(r, null)
})

test('match ตัวแรกที่เจอ (ถ้ามีหลาย ext เดียวกัน)', () => {
  const readdir = makeReaddir(['001.png', '001.jpg', '001.webp'])
  const r = findMatchingCoverSync('C:/c', '001.m4a', readdir)
  // เจอ .png ก่อน (เพราะอยู่ index 0)
  assert.strictEqual(r, path.join('C:/c', '001.png'))
})
