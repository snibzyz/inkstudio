/**
 * Integration test — bundled ffmpeg + encoderArgs() → mp4 จริง
 *
 * รัน: node --test electron/__tests__/render.integration.test.cjs
 *
 * Coverage:
 *   - generate 3 sample audio (.wav 2s sine 440/523/659 Hz) ผ่าน bundled ffmpeg
 *   - generate 3 sample cover via @napi-rs/canvas (canvas → png → disk)
 *   - render mp4 ทั้ง 3 ตอน ผ่าน encoderArgs (Software H.264) → assert mp4 valid + duration ~2s
 *   - render NVENC H.264 ถ้ามี GPU (skipping ถ้าไม่มี — ไม่ fail)
 *   - probe ผลลัพธ์ผ่าน ffmpeg -i → ตรวจ resolution + codec
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')

const { resolveFfmpegPath } = require('../helpers/ffmpeg.cjs')
const { encoderArgs, formatRes, parseDuration } = require('../ipc/renderHelpers.cjs')

let canvasMod
try {
  canvasMod = require('@napi-rs/canvas')
} catch {
  canvasMod = null
}

const TMP_DIR = path.join(os.tmpdir(), `inkstudio-rt-${Date.now()}`)
const COVERS_DIR = path.join(TMP_DIR, 'covers')
const AUDIO_DIR = path.join(TMP_DIR, 'audio')
const OUT_DIR = path.join(TMP_DIR, 'out')
const LOGO_PATH = path.resolve(__dirname, '..', '..', 'public', 'logo.png')

function runFfmpeg(args, captureStderr = false) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const proc = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', (c) => {
      if (captureStderr) stderr += c.toString('utf-8')
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}\n${stderr}`))
      resolve(stderr)
    })
  })
}

function probe(file) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const proc = spawn(ffmpegPath, ['-i', file, '-f', 'null', '-'], { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', (c) => { stderr += c.toString('utf-8') })
    proc.on('error', reject)
    proc.on('close', () => resolve(stderr))
  })
}

test.before(() => {
  fs.mkdirSync(COVERS_DIR, { recursive: true })
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })
})

test.after(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
})

test('setup — สร้าง covers 3 ไฟล์ผ่าน @napi-rs/canvas', () => {
  assert.ok(canvasMod, '@napi-rs/canvas not installed')
  const { createCanvas } = canvasMod
  for (let i = 1; i <= 3; i += 1) {
    const c = createCanvas(1280, 720)
    const ctx = c.getContext('2d')
    // gradient bg
    const g = ctx.createLinearGradient(0, 0, 1280, 720)
    g.addColorStop(0, '#78350F')
    g.addColorStop(1, '#F59E0B')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1280, 720)
    // chapter text
    ctx.font = 'bold 120px sans-serif'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Chapter ${String(i).padStart(3, '0')}`, 640, 360)
    fs.writeFileSync(path.join(COVERS_DIR, `${String(i).padStart(3, '0')}.png`), c.toBuffer('image/png'))
  }
  const files = fs.readdirSync(COVERS_DIR).sort()
  assert.deepStrictEqual(files, ['001.png', '002.png', '003.png'])
  for (const f of files) {
    assert.ok(fs.statSync(path.join(COVERS_DIR, f)).size > 1024)
  }
})

test('setup — สร้าง audio 3 ไฟล์ผ่าน bundled ffmpeg (sine 2s)', async () => {
  const freqs = [440, 523, 659]
  for (let i = 0; i < 3; i += 1) {
    const out = path.join(AUDIO_DIR, `${String(i + 1).padStart(3, '0')}.wav`)
    await runFfmpeg([
      '-y',
      '-f', 'lavfi',
      '-i', `sine=frequency=${freqs[i]}:duration=2`,
      '-ac', '1',
      '-ar', '44100',
      out,
    ])
    assert.ok(fs.existsSync(out))
    assert.ok(fs.statSync(out).size > 1024)
  }
})

test('render — software H.264 ทั้ง 3 ตอน + ตรวจ output valid', async () => {
  const res = formatRes('720p')
  for (let i = 1; i <= 3; i += 1) {
    const pad = String(i).padStart(3, '0')
    const cover = path.join(COVERS_DIR, `${pad}.png`)
    const audio = path.join(AUDIO_DIR, `${pad}.wav`)
    const output = path.join(OUT_DIR, `${pad}.mp4`)
    await runFfmpeg([
      '-y',
      '-loop', '1',
      '-i', cover,
      '-i', audio,
      '-shortest',
      '-vf', `scale=${res.w}:${res.h}:force_original_aspect_ratio=increase,crop=${res.w}:${res.h}`,
      ...encoderArgs('Software (H.264)', 28),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-r', '1',
      '-movflags', '+faststart',
      output,
    ])
    assert.ok(fs.existsSync(output))
    assert.ok(fs.statSync(output).size > 8 * 1024, `mp4 too small: ${fs.statSync(output).size}`)
  }
  const files = fs.readdirSync(OUT_DIR).sort()
  assert.deepStrictEqual(files, ['001.mp4', '002.mp4', '003.mp4'])
})

test('probe — mp4 ทุกตัว duration ใกล้ 2s + resolution 1280×720 + codec h264', async () => {
  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.mp4')).sort()
  assert.strictEqual(files.length, 3)
  for (const f of files) {
    const stderr = await probe(path.join(OUT_DIR, f))
    const dur = parseDuration(stderr)
    assert.ok(dur !== null, `no duration for ${f}`)
    assert.ok(dur >= 1.5 && dur <= 3.5, `${f} duration ${dur} not in [1.5, 3.5]`)
    assert.match(stderr, /1280x720/u, `${f} not 1280x720`)
    assert.match(stderr, /h264/iu, `${f} not h264`)
  }
})

test('render — NVENC H.264 (optional, skip ถ้าไม่มี GPU)', async () => {
  let encoders = ''
  try {
    encoders = await runFfmpeg(['-hide_banner', '-encoders'], true)
  } catch {
    return
  }
  if (!/h264_nvenc/u.test(encoders)) {
    // ไม่มี NVENC — skip
    return
  }
  const cover = path.join(COVERS_DIR, '001.png')
  const audio = path.join(AUDIO_DIR, '001.wav')
  const output = path.join(OUT_DIR, 'nvenc-001.mp4')
  const res = formatRes('1080p')
  try {
    await runFfmpeg([
      '-y',
      '-loop', '1',
      '-i', cover,
      '-i', audio,
      '-shortest',
      '-vf', `scale=${res.w}:${res.h}:force_original_aspect_ratio=increase,crop=${res.w}:${res.h}`,
      ...encoderArgs('NVENC (H.264)', 22),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-r', '1',
      '-movflags', '+faststart',
      output,
    ], true)
  } catch (err) {
    // GPU/driver อาจไม่ initialize ได้ — skip
    return
  }
  assert.ok(fs.existsSync(output))
  assert.ok(fs.statSync(output).size > 8 * 1024)
  const stderr = await probe(output)
  assert.match(stderr, /1920x1080/u)
  assert.match(stderr, /h264/iu)
})

test('render — JPG cover ก็ render ได้ (ทดสอบ format mix)', async () => {
  const { createCanvas } = canvasMod
  const c = createCanvas(1280, 720)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(0, 0, 1280, 720)
  ctx.fillStyle = '#F59E0B'
  ctx.font = 'bold 80px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('JPG cover', 640, 360)
  const coverJpg = path.join(COVERS_DIR, 'jpg-test.jpg')
  fs.writeFileSync(coverJpg, c.toBuffer('image/jpeg', { quality: 0.85 }))

  const audio = path.join(AUDIO_DIR, '001.wav')
  const output = path.join(OUT_DIR, 'jpg-test.mp4')
  const res = formatRes('480p')
  await runFfmpeg([
    '-y',
    '-loop', '1',
    '-i', coverJpg,
    '-i', audio,
    '-shortest',
    '-vf', `scale=${res.w}:${res.h}:force_original_aspect_ratio=increase,crop=${res.w}:${res.h}`,
    ...encoderArgs('Software (H.264)', 28),
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-r', '1',
    '-movflags', '+faststart',
    output,
  ])
  assert.ok(fs.existsSync(output))
  assert.ok(fs.statSync(output).size > 8 * 1024)
})

test('render — fallback gradient เมื่อไม่มีภาพ (ใช้ logo.png ของแอป)', async () => {
  assert.ok(fs.existsSync(LOGO_PATH), `logo.png missing at ${LOGO_PATH}`)
  const audio = path.join(AUDIO_DIR, '001.wav')
  const output = path.join(OUT_DIR, 'logo-test.mp4')
  const res = formatRes('720p')
  await runFfmpeg([
    '-y',
    '-loop', '1',
    '-i', LOGO_PATH,
    '-i', audio,
    '-shortest',
    '-vf', `scale=${res.w}:${res.h}:force_original_aspect_ratio=increase,crop=${res.w}:${res.h}`,
    ...encoderArgs('Software (H.264)', 30),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-r', '1',
    output,
  ])
  assert.ok(fs.statSync(output).size > 4 * 1024)
})
