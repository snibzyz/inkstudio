'use strict'
/**
 * renderHelpers — shared utilities สำหรับ render IPC handlers
 *
 * - ffmpeg process spawn + progress parsing
 * - cover/audio file matching (range / number / regex fallback)
 * - preset store I/O
 * - misc text helpers (parseTime/formatTime)
 *
 * แยกออกจาก render.cjs เพื่อกัน main IPC ไฟล์โตเกิน (เคย 766 บรรทัด)
 */

const path = require('path')
const fs = require('fs')
const fsp = require('fs/promises')
const { spawn, execSync } = require('child_process')
const { app } = require('electron')
const { getFfmpegPath } = require('../../helpers/nativePaths.cjs')
const { safeAttempt } = require('../../helpers/safeAttempt.cjs')

const ffmpegPath = getFfmpegPath()

/* ─── job tracking ─────────────────────────────────────────────────────── */
const activeRenderJobs = new Map()
const trackedFfmpegChildren = new Set()

/** Graceful-quit window — ffmpeg has up to this many ms to write its trailer
 *  and exit cleanly after we send it `q` on stdin. Past this, we SIGKILL so
 *  the user never gets stuck if ffmpeg ignores the request (rare, but happens
 *  with a stuck input). 10 s lets even multi-GB muxes finalize on a slow
 *  disk before we force-kill. */
const GRACEFUL_QUIT_TIMEOUT_MS = 10000

function isFfmpegCommand(command) {
  if (!ffmpegPath || typeof command !== 'string') return false
  try {
    return path.resolve(command) === path.resolve(ffmpegPath)
  } catch {
    return command === ffmpegPath
  }
}

function trackFfmpegSpawn(child) {
  if (!child || typeof child.kill !== 'function') return
  trackedFfmpegChildren.add(child)
  const detach = () => trackedFfmpegChildren.delete(child)
  child.once('close', detach)
  child.once('error', detach)
}

/**
 * Graceful ffmpeg stop — Photoshop-style "save what we have" cancel.
 *
 * Writes `q\n` to ffmpeg's stdin (its documented "press q to stop" interface)
 * so it finalizes the muxer and the output `.mp4` is playable. If ffmpeg
 * doesn't exit within `GRACEFUL_QUIT_TIMEOUT_MS` we fall back to SIGKILL so
 * the user is never stuck.
 *
 * Caller passes `force: true` to skip the graceful step (app shutdown — no
 * time to wait, and a half-written file is acceptable when the user is
 * closing the whole app).
 */
function stopFfmpegChild(child, { force = false, reason = '' } = {}) {
  if (!child || child.exitCode != null || child.killed) return
  if (force) {
    safeAttempt(`kill ffmpeg (${reason || 'force'})`, () => child.kill('SIGKILL'))
    return
  }
  // Mark the child so the spawn-helper's close handler can resolve instead
  // of rejecting — a user cancel is not an "error".
  child.__inkideaGracefulQuit = true
  // Try graceful first — ffmpeg listens for `q` on stdin and writes the trailer.
  let finalized = false
  child.once('close', () => { finalized = true })
  try {
    if (child.stdin && !child.stdin.destroyed && child.stdin.writable) {
      /** เขียนแค่ `q\n` — อย่าเรียก `end()` เพราะการปิด stdin เร็วเกินไปทำให้ ffmpeg
       *  ออกก่อนอ่าน `q` ที่ค้างใน queue → muxer ไม่ถูก finalize (ไม่มี moov atom →
       *  .mp4 เล่นไม่ได้). ffmpeg จะปิด stdin เองตอนออก */
      child.stdin.write('q\n')
    } else {
      // No stdin pipe — fall straight back to SIGKILL.
      safeAttempt(`kill ffmpeg (no-stdin · ${reason})`, () => child.kill('SIGKILL'))
      return
    }
  } catch {
    safeAttempt(`kill ffmpeg (stdin-failed · ${reason})`, () => child.kill('SIGKILL'))
    return
  }
  // Backstop: if ffmpeg ignores `q`, force-kill after the timeout. This is
  // the only place SIGKILL fires during a normal user cancel.
  setTimeout(() => {
    if (finalized) return
    safeAttempt(`kill ffmpeg (graceful timeout · ${reason})`, () => child.kill('SIGKILL'))
  }, GRACEFUL_QUIT_TIMEOUT_MS).unref?.()
}

/** True if the child was asked to stop gracefully — the spawn helpers use
 *  this to treat the exit as a success rather than an error. */
function isGracefulQuit(child) {
  return Boolean(child && child.__inkideaGracefulQuit)
}

/**
 * Stop every tracked render job + ffmpeg child.
 *
 * `force: false` (default) → graceful — used for the user's "หยุด" button so
 *   the partial mp4 is playable.
 * `force: true` → SIGKILL all — used when the app is closing; ffmpeg has no
 *   time to finalize, but the user is closing anyway.
 */
function stopAllFfmpegAndRenderJobs({ force = false } = {}) {
  for (const [, job] of activeRenderJobs) {
    if (job && job.children) {
      for (const child of job.children) {
        stopFfmpegChild(child, { force, reason: 'stop-all' })
      }
    }
  }
  activeRenderJobs.clear()
  for (const child of [...trackedFfmpegChildren]) {
    stopFfmpegChild(child, { force, reason: 'tracked' })
  }
  if (force) trackedFfmpegChildren.clear()
}

/* ─── process spawn ────────────────────────────────────────────────────── */
function runProcess(command, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    /** stdin = 'pipe' so we can send `q\n` to ffmpeg for a graceful stop.
     *  Non-ffmpeg commands also get a pipe — harmless, never written to. */
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    if (isFfmpegCommand(command)) trackFfmpegSpawn(child)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr })
      // A graceful stop (user clicked "หยุด" → we wrote `q` to stdin) exits
      // with a non-zero code but the output file is finalized. Treat it as
      // success so the renderer doesn't surface a spurious error.
      if (isGracefulQuit(child)) return resolve({ stdout, stderr, cancelled: true })
      reject(new Error(`คำสั่งล้มเหลว (${command}): ${stderr || `รหัสออก ${code}`}`))
    })
  })
}

function runFfmpegWithProgress(command, args, { totalSeconds, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    /** stdin pipe lets us request a graceful quit via `q` — partial output
     *  file still finalizes correctly when the user clicks stop mid-encode. */
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    if (isFfmpegCommand(command)) trackFfmpegSpawn(child)
    let stderr = ''
    let stdoutBuffer = ''
    let lastOutTimeMsUs = null
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        const idx = line.indexOf('=')
        if (idx === -1) continue
        const key = line.slice(0, idx)
        const value = line.slice(idx + 1)
        if (key === 'out_time_ms') {
          const v = Number(value)
          if (Number.isFinite(v)) lastOutTimeMsUs = v * 1000
        }
        if (key === 'progress' && typeof onProgress === 'function') {
          const prog = value
          if (prog === 'continue' || prog === 'end') {
            if (typeof totalSeconds === 'number' && Number.isFinite(totalSeconds) && totalSeconds > 0 && lastOutTimeMsUs != null) {
              const totalUs = totalSeconds * 1000000
              const percent = Math.min(1, Math.max(0, lastOutTimeMsUs / totalUs))
              onProgress({ percent, done: prog === 'end' })
            } else {
              onProgress({ percent: 0, done: prog === 'end' })
            }
          }
        }
      }
    })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) return resolve()
      if (isGracefulQuit(child)) return resolve({ cancelled: true })
      reject(new Error(`คำสั่งล้มเหลว (${command}): ${stderr || `รหัสออก ${code}`}`))
    })
  })
}

function runFfmpegWithTimeParsing(command, args, { onTimeLine, registerChild, unregisterChild } = {}) {
  return new Promise((resolve, reject) => {
    /** stdin pipe → graceful stop on cancel (write `q\n`). */
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    if (isFfmpegCommand(command)) trackFfmpegSpawn(child)
    if (typeof registerChild === 'function') registerChild(child)
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      if (typeof onTimeLine === 'function') onTimeLine(text)
    })
    child.on('error', (err) => {
      if (typeof unregisterChild === 'function') unregisterChild(child)
      reject(err)
    })
    child.on('close', (code) => {
      if (typeof unregisterChild === 'function') unregisterChild(child)
      if (code === 0) return resolve()
      if (isGracefulQuit(child)) return resolve({ cancelled: true })
      reject(new Error(`คำสั่งล้มเหลว (${command}): ${stderr || `รหัสออก ${code}`}`))
    })
  })
}

/* ─── time / text helpers ──────────────────────────────────────────────── */
function parseTime(timeStr) {
  try {
    const parts = String(timeStr).split(':')
    if (parts.length !== 3) return 0
    const [hours, minutes, seconds] = parts.map(Number)
    if (![hours, minutes, seconds].every(Number.isFinite)) return 0
    return hours * 3600 + minutes * 60 + seconds
  } catch {
    return 0
  }
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

function extractNumbers(text) {
  return String(text).match(/\d+/g) ?? []
}

function extractNumberOrRanges(text) {
  return String(text).match(/\d+(?:-\d+)?/g) ?? []
}

function normalizeConcatPath(p) {
  return p.replace(/\\/g, '/')
}

function listFilesByExt(folderPath, extensions) {
  const extSet = new Set(extensions.map((ext) => ext.toLowerCase()))
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => extSet.has(path.extname(name).toLowerCase()))
}

/* ─── cover/audio matching ─────────────────────────────────────────────── */
function buildCoverIndex(coverFolder) {
  const coverFilesList = listFilesByExt(coverFolder, ['.png', '.jpg', '.jpeg'])
  const coverImagesMap = {}
  const coverRangesMap = {}
  for (const coverFile of coverFilesList) {
    const coverPath = path.join(coverFolder, coverFile)
    const coverBase = path.parse(coverFile).name
    const rangeMatch = coverBase.match(/(\d+)\s*-\s*(\d+)/)
    if (rangeMatch) {
      const startInt = Number(rangeMatch[1])
      const endInt = Number(rangeMatch[2])
      const lo = Math.min(startInt, endInt)
      const hi = Math.max(startInt, endInt)
      coverRangesMap[coverPath] = {
        start: rangeMatch[1],
        end: rangeMatch[2],
        startInt: lo,
        endInt: hi,
        padding: rangeMatch[1].length,
      }
    }
    const coverNumbers = extractNumbers(coverFile)
    for (const num of coverNumbers) {
      const normalizedNum = num.replace(/^0+/, '') || num
      if (!coverImagesMap[normalizedNum]) coverImagesMap[normalizedNum] = []
      if (!coverImagesMap[normalizedNum].includes(coverPath)) coverImagesMap[normalizedNum].push(coverPath)
      if (num !== normalizedNum) {
        if (!coverImagesMap[num]) coverImagesMap[num] = []
        if (!coverImagesMap[num].includes(coverPath)) coverImagesMap[num].push(coverPath)
      }
    }
  }
  Object.keys(coverImagesMap).forEach((key) => { coverImagesMap[key].sort() })
  return { coverFilesList, coverImagesMap, coverRangesMap }
}

function matchCoverForAudio(audioFile, coverFolder, coverIndex) {
  const { coverFilesList, coverImagesMap, coverRangesMap } = coverIndex

  const audioBase = path.parse(audioFile).name
  const audioRangeMatch = audioBase.match(/(\d+)\s*-\s*(\d+)/)
  if (audioRangeMatch) {
    const a1 = Number(audioRangeMatch[1])
    const a2 = Number(audioRangeMatch[2])
    const audioLo = Math.min(a1, a2)
    const audioHi = Math.max(a1, a2)

    for (const [coverPath, rangeInfo] of Object.entries(coverRangesMap)) {
      if (rangeInfo.startInt === audioLo && rangeInfo.endInt === audioHi) {
        return coverPath
      }
    }
    for (const [coverPath, rangeInfo] of Object.entries(coverRangesMap)) {
      if (rangeInfo.startInt <= audioLo && audioHi <= rangeInfo.endInt) {
        return coverPath
      }
    }
  }

  const audioNumbers = extractNumbers(audioFile)
  let coverImage = null
  if (audioNumbers.length > 0) {
    for (const numStr of audioNumbers) {
      const numInt = Number(numStr)
      for (const [coverPath, rangeInfo] of Object.entries(coverRangesMap)) {
        if (rangeInfo.startInt <= numInt && numInt <= rangeInfo.endInt) {
          coverImage = coverPath
          break
        }
      }
      if (coverImage) break
    }
    if (!coverImage) {
      const sorted = [...audioNumbers].sort((a, b) => b.length - a.length)
      for (const num of sorted) {
        const normalizedNum = num.replace(/^0+/, '') || num
        if (coverImagesMap[normalizedNum]?.[0]) { coverImage = coverImagesMap[normalizedNum][0]; break }
        if (coverImagesMap[num]?.[0]) { coverImage = coverImagesMap[num][0]; break }
        for (const coverFile of coverFilesList) {
          const coverBase = path.parse(coverFile).name
          const regex = new RegExp(`\\b${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
          if (regex.test(coverBase)) { coverImage = path.join(coverFolder, coverFile); break }
        }
        if (coverImage) break
      }
    }
  }
  return coverImage
}

/* ─── encoder detection + probe ────────────────────────────────────────── */

/** อ่านชื่อ GPU + เวอร์ชันไดรเวอร์ NVIDIA — null ถ้าไม่มี/ตรวจไม่ได้ */
function getNvidiaInfo() {
  return new Promise((resolve) => {
    let stdout = ''
    let settled = false
    const done = (v) => { if (!settled) { settled = true; resolve(v) } }
    try {
      const child = spawn('nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader'], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', (c) => { stdout += c.toString() })
      child.on('error', () => done(null))
      child.on('close', () => {
        const line = (stdout.split(/\r?\n/)[0] || '').trim()
        if (!line) return done(null)
        const [name, driver] = line.split(',').map((s) => s.trim())
        done({ name: name || 'NVIDIA GPU', driver: driver || '' })
      })
      setTimeout(() => { try { child.kill() } catch { /* ignore */ } done(null) }, 5000)
    } catch { done(null) }
  })
}

/** สรุปสาเหตุที่ NVENC ใช้ไม่ได้จาก stderr ของ ffmpeg ให้ผู้ใช้เข้าใจ + ทำตามได้ */
function summarizeNvencError(stderr) {
  const s = String(stderr || '')
  if (/required nvenc API version|nvenc API version|minimum required/i.test(s)) {
    return 'ไดรเวอร์การ์ดจอ NVIDIA เก่าเกินไป — อัปเดตไดรเวอร์ที่ nvidia.com แล้วจะเรนเดอร์ด้วย GPU ได้'
  }
  if (/nvcuda\.dll|Cannot load|cuInit/i.test(s)) {
    return 'โหลดไดรเวอร์ NVIDIA ไม่ได้ — ติดตั้ง/อัปเดตไดรเวอร์การ์ดจอ'
  }
  if (/No capable devices|no NVIDIA|no devices/i.test(s)) {
    return 'ไม่พบการ์ดจอ NVIDIA ที่ใช้ NVENC ได้บนเครื่องนี้'
  }
  if (/OpenEncodeSession|sessions|out of memory/i.test(s)) {
    return 'NVENC เปิดการเข้ารหัสไม่ได้ (ไดรเวอร์/การ์ดจอ) — ลองอัปเดตไดรเวอร์'
  }
  const line = s.split(/\r?\n/).reverse().find((l) => /error|failed|unable|unsupported/i.test(l))
  return line ? line.trim().slice(0, 200) : 'NVENC ใช้งานไม่ได้บนเครื่องนี้'
}

/**
 * Probe a single ffmpeg encoder by encoding 1 black frame at 256×256
 * (above NVENC's minimum supported dimension). Returns `{ ok, error }`.
 * Used to test each codec independently — see `probeNvencH264`,
 * `probeNvencHevc`, `probeVtH264`, `probeVtHevc` below.
 *
 * Same approach as OBS / HandBrake: run a real encode rather than trust
 * driver presence — handles old drivers, GPU/codec mismatches, etc.
 */
function probeFfmpegEncoder(codec, preset = null) {
  return new Promise((resolve) => {
    let settled = false
    let stderr = ''
    const done = (v) => { if (!settled) { settled = true; resolve(v) } }
    if (!ffmpegPath) return done({ ok: false, error: 'ไม่พบ FFmpeg ในโปรแกรม' })
    try {
      const args = [
        '-hide_banner', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:r=1:d=1',
        '-c:v', codec,
      ]
      if (preset) args.push('-preset', preset)
      args.push('-frames:v', '1', '-f', 'null', '-')
      const child = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
      child.stderr.on('data', (c) => { stderr += c.toString() })
      child.on('error', (e) => done({ ok: false, error: String((e && e.message) || e) }))
      child.on('close', (code) => {
        if (code === 0) return done({ ok: true, error: '' })
        done({ ok: false, error: summarizeNvencError(stderr) })
      })
      setTimeout(() => { try { child.kill() } catch { /* ignore */ } done({ ok: false, error: `ทดสอบ ${codec} นานเกินไป` }) }, 12000)
    } catch (e) {
      done({ ok: false, error: String((e && e.message) || e) })
    }
  })
}

const probeNvencH264 = () => probeFfmpegEncoder('h264_nvenc', 'default')
const probeNvencHevc = () => probeFfmpegEncoder('hevc_nvenc', 'default')
const probeVtH264 = () => probeFfmpegEncoder('h264_videotoolbox')
const probeVtHevc = () => probeFfmpegEncoder('hevc_videotoolbox')

/** Backward-compat alias kept for any pre-existing imports of `probeNvenc`. */
const probeNvenc = probeNvencH264

/** cache ผลวินิจฉัย encoder ต่อ process — อัปเดตไดรเวอร์แล้วรีสตาร์ตแอป cache จะ refresh */
let cachedEncoderDiag = null

// Picker lives in its own deps-free file so vitest can require it directly.
const { pickPreferredEncoder } = require('./pickPreferredEncoder.cjs')

/**
 * วินิจฉัย encoder — probe ทุก codec ที่เป็นไปได้บน OS นี้แล้วคืนผลแยกราย encoder.
 *
 * คืน:
 *   {
 *     preferred,                 // ชื่อ encoder ที่ระบบเลือกให้ (H.264 hardware first)
 *     platform,
 *     gpu: { name, driver } | null,
 *     encoders: {
 *       nvencH264: { ok, error },  // Windows/Linux only — null on macOS
 *       nvencHevc: { ok, error },
 *       vtH264:    { ok, error },  // macOS only — null on Windows/Linux
 *       vtHevc:    { ok, error },
 *       software:  { ok, error },  // always ok (libx264 ships with ffmpeg)
 *     },
 *     // back-compat for callers that still read `diag.nvenc`
 *     nvenc: { ok, error },        // = encoders.nvencH264 on Windows/Linux, ok:false on macOS
 *   }
 */
async function diagnoseEncoder(force = false) {
  if (cachedEncoderDiag && !force) return cachedEncoderDiag

  const softwareOk = { ok: true, error: '' }

  if (process.platform === 'darwin') {
    const [vtH264, vtHevc] = await Promise.all([probeVtH264(), probeVtHevc()])
    const encoders = {
      nvencH264: { ok: false, error: 'macOS — ใช้ VideoToolbox แทน' },
      nvencHevc: { ok: false, error: 'macOS — ใช้ VideoToolbox แทน' },
      vtH264, vtHevc,
      software: softwareOk,
    }
    cachedEncoderDiag = {
      preferred: pickPreferredEncoder({ platform: 'darwin', encoders }),
      platform: 'darwin', gpu: null, encoders,
      nvenc: { ok: false, error: '' },
    }
    return cachedEncoderDiag
  }

  const gpu = await getNvidiaInfo()
  if (!gpu) {
    const noGpu = { ok: false, error: 'ไม่พบการ์ดจอ NVIDIA' }
    const encoders = {
      nvencH264: noGpu, nvencHevc: noGpu,
      vtH264: { ok: false, error: 'ไม่ใช่ macOS' },
      vtHevc: { ok: false, error: 'ไม่ใช่ macOS' },
      software: softwareOk,
    }
    cachedEncoderDiag = {
      preferred: pickPreferredEncoder({ platform: process.platform, encoders }),
      platform: process.platform, gpu: null, encoders, nvenc: noGpu,
    }
    return cachedEncoderDiag
  }

  // GPU present — probe both NVENC codecs in parallel
  const [nvencH264, nvencHevc] = await Promise.all([probeNvencH264(), probeNvencHevc()])
  const encoders = {
    nvencH264, nvencHevc,
    vtH264: { ok: false, error: 'ไม่ใช่ macOS' },
    vtHevc: { ok: false, error: 'ไม่ใช่ macOS' },
    software: softwareOk,
  }
  cachedEncoderDiag = {
    preferred: pickPreferredEncoder({ platform: process.platform, encoders }),
    platform: process.platform, gpu, encoders, nvenc: nvencH264,
  }
  return cachedEncoderDiag
}

/** คืนชื่อ encoder ที่ควรใช้ (string) — wrapper บาง ๆ ของ diagnoseEncoder */
async function detectPreferredEncoder() {
  const diag = await diagnoseEncoder()
  return diag.preferred
}

/**
 * สร้าง args ของ video encoder ตาม encode option ที่เลือก
 *
 * สำคัญ: preset/rate-control ของแต่ละ encoder ไม่เหมือนกัน
 *  - libx264 ใช้ preset 'ultrafast'..'veryslow' + '-crf'
 *  - h264_nvenc / hevc_nvenc ไม่รู้จัก 'ultrafast' (เป็น preset ของ libx264)
 *    ใช้ preset 'default' + rate-control '-cq' แทน '-crf'
 *  - h264_videotoolbox (macOS) ไม่รองรับ '-preset'/'-crf'/'-cq' — ใช้ '-b:v' (bitrate)
 *    ภาพเป็นภาพนิ่งเฟรมเดียว bitrate จึงแทบไม่ถูกใช้จริง ตั้งสูงไว้พอ
 *
 * ทำไม NVENC ใช้ '-preset default' ไม่ใช่ 'p4':
 *   preset p1..p7 เพิ่งมีใน NVENC SDK 10+ (ไดรเวอร์ ~ปี 2020 ขึ้นไป) — การ์ดจอ
 *   Turing เช่น RTX 2070 ที่ไดรเวอร์เก่ากว่านั้นจะเปิด encoder ไม่ได้แล้วตกไปใช้ CPU.
 *   'default' map กับ NV_ENC_PRESET_DEFAULT_GUID ที่มีในไดรเวอร์ NVENC ทุกเวอร์ชัน
 *   → การ์ดจอ NVIDIA ทุกรุ่นทุกไดรเวอร์เรนเดอร์ด้วย GPU ได้จริง
 * ส่ง 'ultrafast' ให้ NVENC จะทำให้ ffmpeg เปิด encoder ไม่ได้ ("Unable to parse
 * option value ultrafast") — เป็นสาเหตุที่เครื่องที่มีการ์ดจอ NVIDIA เรนเดอร์ไม่ได้
 */
function buildVideoEncodeArgs(encodeOption, crf) {
  const quality = Number.isFinite(crf) ? Math.round(crf) : 30
  switch (encodeOption) {
    case 'NVENC (H.264)':
    case 'NVIDIA NVENC (H.264)':
      return ['-c:v', 'h264_nvenc', '-profile:v', 'high', '-preset', 'default', '-rc', 'vbr', '-cq', String(quality), '-b:v', '0']
    case 'NVENC (H.265)':
      return ['-c:v', 'hevc_nvenc', '-preset', 'default', '-rc', 'vbr', '-cq', String(quality), '-b:v', '0']
    case 'VideoToolbox (H.264)':
      return ['-c:v', 'h264_videotoolbox', '-b:v', '2500k']
    case 'VideoToolbox (H.265)':
      return ['-c:v', 'hevc_videotoolbox', '-b:v', '2500k']
    case 'Software (H.264)':
    default:
      return ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(quality)]
  }
}

function listSystemFontFamilies() {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        'powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families | ForEach-Object { $_.Name }"',
        { encoding: 'utf8', timeout: 10000 }
      )
      return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    }
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const out = execSync('fc-list : family', { encoding: 'utf8', timeout: 8000 })
      return [...new Set(out.split(/[,\r\n]+/).map((s) => s.trim()).filter(Boolean))].sort()
    }
    return []
  } catch {
    return []
  }
}

/* ─── preset store ─────────────────────────────────────────────────────── */
function getPresetFilePath() {
  return path.join(app.getPath('userData'), 'video-renderer-presets.json')
}

async function readPresets() {
  const filePath = getPresetFilePath()
  try {
    const raw = await fsp.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writePresets(presets) {
  const filePath = getPresetFilePath()
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, JSON.stringify(presets, null, 2), 'utf8')
}

module.exports = {
  activeRenderJobs,
  buildCoverIndex,
  buildVideoEncodeArgs,
  detectPreferredEncoder,
  diagnoseEncoder,
  extractNumberOrRanges,
  extractNumbers,
  formatTime,
  isGracefulQuit,
  listFilesByExt,
  listSystemFontFamilies,
  matchCoverForAudio,
  normalizeConcatPath,
  parseTime,
  pickPreferredEncoder,
  readPresets,
  runFfmpegWithProgress,
  runFfmpegWithTimeParsing,
  runProcess,
  stopAllFfmpegAndRenderJobs,
  stopFfmpegChild,
  writePresets,
}
