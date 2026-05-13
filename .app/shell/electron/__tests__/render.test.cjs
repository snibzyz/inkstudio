/**
 * smoke test สำหรับ electron/ipc/render.cjs — ทดสอบ pure helpers + actual ffmpeg invocation
 *
 * รันด้วย: node --test electron/__tests__/render.test.cjs
 *
 * Coverage:
 *   - encoderArgs map encoder label → ffmpeg args
 *   - formatRes map resolution label → {w,h}
 *   - parseDuration / parseTime / formatTime
 *   - resolveFfmpegPath คืน path ที่ exists จริง
 *   - spawn ffmpeg -version ได้
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const { spawn } = require('node:child_process')

const { encoderArgs, formatRes, parseTime, parseDuration, formatTime } = require('../ipc/renderHelpers.cjs')
const { resolveFfmpegPath } = require('../helpers/ffmpeg.cjs')

test('encoderArgs — NVENC H.264 → h264_nvenc', () => {
  const args = encoderArgs('NVENC (H.264)', 23)
  assert.ok(args.includes('h264_nvenc'))
  assert.ok(args.includes('-cq'))
  assert.ok(args.includes('23'))
})

test('encoderArgs — NVENC H.265 → hevc_nvenc', () => {
  const args = encoderArgs('NVENC (H.265)', 22)
  assert.ok(args.includes('hevc_nvenc'))
})

test('encoderArgs — Software → libx264 + yuv420p', () => {
  const args = encoderArgs('Software (H.264)', 28)
  assert.ok(args.includes('libx264'))
  assert.ok(args.includes('-crf'))
  assert.ok(args.includes('28'))
  assert.ok(args.includes('yuv420p'))
})

test('formatRes', () => {
  assert.deepStrictEqual(formatRes('480p'), { w: 854, h: 480 })
  assert.deepStrictEqual(formatRes('720p'), { w: 1280, h: 720 })
  assert.deepStrictEqual(formatRes('1080p'), { w: 1920, h: 1080 })
  assert.deepStrictEqual(formatRes('unknown'), { w: 1280, h: 720 }) // default fallback
})

test('parseDuration — รู้จัก "Duration: HH:MM:SS.xx"', () => {
  const line = '  Duration: 00:01:30.45, start: 0.000000, bitrate: 192 kb/s'
  assert.strictEqual(parseDuration(line), 90.45)
})

test('parseDuration — null ถ้าไม่เจอ', () => {
  assert.strictEqual(parseDuration('no duration here'), null)
})

test('parseTime — รู้จัก "time=HH:MM:SS.xx"', () => {
  assert.strictEqual(parseTime('frame=1 fps=0.0 time=00:00:45.20 bitrate=N/A'), 45.20)
})

test('formatTime — pad zero ทั้ง 3 หลัก', () => {
  assert.strictEqual(formatTime(0), '00:00:00')
  assert.strictEqual(formatTime(65), '00:01:05')
  assert.strictEqual(formatTime(3725), '01:02:05')
})

test('formatTime — clamp negative', () => {
  assert.strictEqual(formatTime(-5), '00:00:00')
})

test('resolveFfmpegPath — คืน path ที่มีไฟล์อยู่จริง', () => {
  const p = resolveFfmpegPath()
  assert.ok(typeof p === 'string' && p.length > 0)
  assert.ok(fs.existsSync(p), `ffmpeg binary should exist at ${p}`)
})

test('ffmpeg -version — รันได้และคืน version string', async () => {
  const p = resolveFfmpegPath()
  await new Promise((resolve, reject) => {
    const proc = spawn(p, ['-version'], { windowsHide: true })
    let out = ''
    proc.stdout.on('data', (c) => { out += c.toString('utf-8') })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`))
      assert.match(out, /ffmpeg version/u)
      resolve()
    })
  })
})
