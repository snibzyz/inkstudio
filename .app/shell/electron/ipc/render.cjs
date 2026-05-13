/**
 * render.cjs — FFmpeg orchestration สำหรับโมดูล "เรนเดอร์คลิป"
 *
 * รับเสียง 1 ไฟล์ + ภาพปก 1 ไฟล์ → render เป็น .mp4 (1280×720, libx264, AAC) แบบ batch ได้
 *
 * Channels:
 *   render:startBatch       { jobId, coverFolder/coverPath, useMultipleCovers, audioFolder,
 *                             selectedAudioFiles, outputFolder, titlePrefix, encodeOption,
 *                             crfValue, resolutionLabel, overwriteMode }  →  RenderSummary
 *   render:cancelJob        { jobId }  →  void
 *   render:checkFfmpeg      ()  →  { ok, version?, path?, error? }
 *   render:listAudioFiles   { folderPath }  →  string[]
 *   render:getPreferredEncoder ()  →  encoderLabel  (suggest จาก GPU ที่มี)
 *
 * Events ส่งกลับ renderer:
 *   render:progress   ProgressPayload   (per-chunk parse จาก ffmpeg stderr)
 *
 * FFmpeg binary: ใช้ ffmpeg-static — path resolve ผ่าน helpers/ffmpeg.cjs (handle asar unpack)
 */

const { ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const { spawn } = require('node:child_process')
const os = require('node:os')
const { resolveFfmpegPath } = require('../helpers/ffmpeg.cjs')
const { createLogger } = require('../helpers/logger.cjs')
const {
  formatRes,
  encoderArgs,
  parseDuration,
  parseTime,
  formatTime,
  basename,
  nameWithoutExt,
} = require('./renderHelpers.cjs')

const log = createLogger('render')

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg'])
const IMAGE_EXTENSIONS_RE = /\.(png|jpe?g|webp)$/iu

/** active jobs — keyed by jobId */
const activeJobs = new Map()

function broadcastProgress(getWin, payload) {
  try {
    const win = typeof getWin === 'function' ? getWin() : null
    if (!win || win.isDestroyed()) return
    win.webContents.send('render:progress', payload)
  } catch (err) {
    log.warn('broadcast failed', { error: err && err.message })
  }
}


/** หาไฟล์ปกที่ match ชื่อกับไฟล์เสียง — สำหรับ multi-cover mode */
async function findMatchingCover(coverFolder, audioBase) {
  if (!coverFolder || !audioBase) return null
  const entries = await fsp.readdir(coverFolder).catch(() => [])
  const target = nameWithoutExt(audioBase).toLowerCase()
  for (const name of entries) {
    if (!IMAGE_EXTENSIONS_RE.test(name)) continue
    if (nameWithoutExt(name).toLowerCase() === target) {
      return path.join(coverFolder, name)
    }
  }
  return null
}

/**
 * Render 1 file: cover + audio → mp4
 *   อ่าน audio duration ก่อนเริ่ม → progress %  = currentTime / totalDuration
 */
function renderOne({
  jobId,
  coverPath,
  audioPath,
  outputPath,
  res,
  encoderLabel,
  crfValue,
  getWin,
  onCancel,
}) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath()
    const args = [
      '-y',
      '-loop', '1',
      '-i', coverPath,
      '-i', audioPath,
      '-shortest',
      '-vf', `scale=${res.w}:${res.h}:force_original_aspect_ratio=increase,crop=${res.w}:${res.h}`,
      ...encoderArgs(encoderLabel, crfValue),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-r', '1',
      '-movflags', '+faststart',
      outputPath,
    ]

    log.info('ffmpeg spawn', { jobId, file: basename(outputPath) })

    const proc = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    let duration = null
    const fileBase = basename(outputPath)

    onCancel(() => {
      try { proc.kill('SIGKILL') } catch { /* noop */ }
    })

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf-8')
      stderr += text
      if (duration == null) duration = parseDuration(stderr)
      // parse time line by line (per fragment)
      const lines = text.split(/\r?\n/u)
      for (const line of lines) {
        const t = parseTime(line)
        if (t == null || duration == null || duration <= 0) continue
        const ratio = Math.max(0, Math.min(1, t / duration))
        broadcastProgress(getWin, {
          jobId,
          phase: 'encode',
          progress: ratio,
          fileName: fileBase,
          currentTimeText: formatTime(t),
          durationText: formatTime(duration),
        })
      }
    })

    proc.on('error', (err) => {
      log.error('ffmpeg error', { jobId, file: fileBase, error: err && err.message })
      reject(err)
    })

    proc.on('close', (code, signal) => {
      if (signal === 'SIGKILL') {
        return reject(new Error('cancelled'))
      }
      if (code !== 0) {
        const tail = stderr.split(/\r?\n/u).slice(-6).join('\n')
        return reject(new Error(`ffmpeg exited ${code}\n${tail}`))
      }
      resolve()
    })
  })
}

async function startBatchRender(args, getWin) {
  const {
    jobId = `job-${Date.now()}`,
    coverPath = '',
    coverFolder = '',
    useMultipleCovers = false,
    audioFolder = '',
    selectedAudioFiles = [],
    outputFolder = '',
    titlePrefix = '',
    encodeOption = 'Software (H.264)',
    crfValue = 26,
    resolutionLabel = '720p',
    overwriteMode = 'skip',
  } = args || {}

  if (!audioFolder) throw new Error('audioFolder is required')
  if (!outputFolder) throw new Error('outputFolder is required')
  if (!useMultipleCovers && !coverPath) throw new Error('coverPath is required (single-cover mode)')
  if (useMultipleCovers && !coverFolder) throw new Error('coverFolder is required (multi-cover mode)')
  if (!Array.isArray(selectedAudioFiles) || selectedAudioFiles.length === 0) {
    throw new Error('selectedAudioFiles is empty')
  }

  await fsp.mkdir(outputFolder, { recursive: true }).catch(() => undefined)

  const res = formatRes(resolutionLabel)
  const totalFiles = selectedAudioFiles.length
  const t0 = Date.now()
  let successCount = 0
  let skippedCount = 0
  const missingCovers = []
  const cancelHooks = new Set()
  const job = {
    jobId,
    cancelled: false,
    requestCancel() {
      this.cancelled = true
      for (const h of cancelHooks) {
        try { h() } catch { /* noop */ }
      }
    },
  }
  activeJobs.set(jobId, job)

  try {
    for (let i = 0; i < selectedAudioFiles.length; i += 1) {
      if (job.cancelled) break
      const audioName = selectedAudioFiles[i]
      const audioPath = path.join(audioFolder, audioName)
      const baseName = nameWithoutExt(audioName)
      const outName = `${titlePrefix || ''}${baseName}.mp4`
      const outputPath = path.join(outputFolder, outName)

      let cover = coverPath
      if (useMultipleCovers) {
        cover = await findMatchingCover(coverFolder, audioName)
        if (!cover) {
          missingCovers.push(audioName)
          broadcastProgress(() => (typeof getWin === 'function' ? getWin() : null), {
            jobId,
            phase: 'skip',
            progress: i / totalFiles,
            fileName: audioName,
            message: `ข้าม: ไม่พบปกที่ตรงกับ ${audioName}`,
          })
          continue
        }
      }

      if (overwriteMode === 'skip' && fs.existsSync(outputPath)) {
        skippedCount += 1
        broadcastProgress(() => (typeof getWin === 'function' ? getWin() : null), {
          jobId,
          phase: 'skip',
          progress: (i + 1) / totalFiles,
          fileName: outName,
          message: `ข้าม (มีอยู่แล้ว): ${outName}`,
        })
        continue
      }

      broadcastProgress(() => (typeof getWin === 'function' ? getWin() : null), {
        jobId,
        phase: 'start',
        progress: i / totalFiles,
        fileName: outName,
        message: `กำลังเข้ารหัส [${i + 1}/${totalFiles}] ${outName}`,
      })

      let perFileHook = null
      try {
        await renderOne({
          jobId,
          coverPath: cover,
          audioPath,
          outputPath,
          res,
          encoderLabel: encodeOption,
          crfValue,
          getWin,
          onCancel: (h) => {
            perFileHook = h
            cancelHooks.add(h)
          },
        })
        successCount += 1
      } catch (err) {
        if (job.cancelled) break
        log.warn('renderOne failed', { jobId, file: outName, error: err && err.message })
        broadcastProgress(() => (typeof getWin === 'function' ? getWin() : null), {
          jobId,
          phase: 'error',
          progress: (i + 1) / totalFiles,
          fileName: outName,
          message: `ผิดพลาด: ${(err && err.message) || 'unknown'}`,
        })
      } finally {
        if (perFileHook) cancelHooks.delete(perFileHook)
      }
    }
  } finally {
    activeJobs.delete(jobId)
  }

  const elapsedSeconds = (Date.now() - t0) / 1000
  const summary = {
    successCount,
    totalFiles,
    elapsedSeconds,
    skippedCount,
    missingCovers,
    encoder: encodeOption,
    resolutionLabel,
  }
  broadcastProgress(() => (typeof getWin === 'function' ? getWin() : null), {
    jobId,
    phase: 'done',
    progress: 1,
    summary,
  })
  return summary
}

function detectPreferredEncoder() {
  // ตรวจคร่าว ๆ จาก GPU env — production อาจ probe ผ่าน `ffmpeg -encoders` แต่หนัก
  const gpu = (os.cpus()[0] && os.cpus()[0].model) || ''
  if (/nvidia/iu.test(gpu)) return 'NVENC (H.264)'
  return 'Software (H.264)'
}

function registerRenderIpc(getMainWindow) {
  ipcMain.handle('render:checkFfmpeg', async () => {
    try {
      const ffmpegPath = resolveFfmpegPath()
      if (!fs.existsSync(ffmpegPath)) {
        return { ok: false, error: `ffmpeg not found at ${ffmpegPath}` }
      }
      return new Promise((resolve) => {
        const proc = spawn(ffmpegPath, ['-version'], { windowsHide: true })
        let out = ''
        proc.stdout.on('data', (c) => { out += c.toString('utf-8') })
        proc.on('error', (err) => resolve({ ok: false, error: err && err.message }))
        proc.on('close', (code) => {
          if (code !== 0) return resolve({ ok: false, error: `exit ${code}` })
          const m = out.match(/ffmpeg version (\S+)/u)
          resolve({ ok: true, version: m ? m[1] : 'unknown', path: ffmpegPath })
        })
      })
    } catch (err) {
      return { ok: false, error: err && err.message }
    }
  })

  ipcMain.handle('render:listAudioFiles', async (_e, payload) => {
    const folder = String(payload?.folderPath || '')
    if (!folder || !fs.existsSync(folder)) return []
    try {
      const entries = await fsp.readdir(folder, { withFileTypes: true })
      return entries
        .filter((e) => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
        .map((e) => e.name)
        .sort()
    } catch (err) {
      log.warn('listAudioFiles failed', { folder, error: err && err.message })
      return []
    }
  })

  ipcMain.handle('render:getPreferredEncoder', async () => detectPreferredEncoder())

  ipcMain.handle('render:startBatch', async (_e, payload) => {
    try {
      return await startBatchRender(payload, getMainWindow)
    } catch (err) {
      log.error('startBatch failed', { error: err && err.message })
      throw err
    }
  })

  ipcMain.handle('render:cancelJob', (_e, payload) => {
    const jobId = String(payload?.jobId || '')
    const job = activeJobs.get(jobId)
    if (job) job.requestCancel()
    return { ok: true }
  })
}

module.exports = { registerRenderIpc }
