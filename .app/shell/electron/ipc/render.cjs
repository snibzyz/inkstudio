'use strict'
/**
 * render IPC handlers — port จาก INKIDEA (ff47bb5 + 70529c7)
 *
 * - NVENC ทำงานได้บนการ์ดจอ NVIDIA ทุกรุ่น (preset default + -cq + -b:v 0)
 * - VideoToolbox สำหรับ macOS
 * - Probe-based encoder filtering (render:diagnose-encoder) — เฉพาะ encoder ที่ probe ผ่าน
 * - Smart cover matching (range > overlap > single number)
 * - HW encoder fallback → Software ถ้าเรียกใช้งานจริงล้มเหลว
 * - Intro clip concat (2-stage render)
 * - Audio folder watcher (push event ตอน folder มี content เปลี่ยน)
 *
 * Channel names ใช้แบบ INKIDEA — preload + shim สร้าง alias ให้ตรงกับ window.inkstudio.render
 */

const { ipcMain, app, dialog, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const fsp = require('fs/promises')
const os = require('os')
const { spawn, spawnSync } = require('child_process')
const { getFfmpegPath } = require('../helpers/nativePaths.cjs')
const { safeAttemptAsync } = require('../helpers/safeAttempt.cjs')
const { createLogger } = require('../helpers/logger.cjs')
const {
  activeRenderJobs,
  buildCoverIndex,
  buildVideoEncodeArgs,
  detectPreferredEncoder,
  diagnoseEncoder,
  extractNumberOrRanges,
  formatTime,
  listFilesByExt,
  matchCoverForAudio,
  parseTime,
  readPresets,
  runFfmpegWithTimeParsing,
  stopAllFfmpegAndRenderJobs,
  stopFfmpegChild,
  writePresets,
} = require('./render/renderHelpers.cjs')
const { register: registerAudioFolderWatch } = require('./render/audioFolderWatcher.cjs')

const log = createLogger('render')
const ffmpegPath = getFfmpegPath()

/** ตรวจว่าไฟล์มีแทร็กเสียงหรือไม่ — INKSTUDIO ไม่มี ffprobe จึง parse จาก ffmpeg -i (เขียนข้อมูล stream ไป stderr)
 *  ใช้กับ intro วิดีโอ: ถ้าไม่มีเสียง ต้องเติม anullsrc ก่อน concat (ที่อ้าง [0:a]) */
function ffmpegInputHasAudio(ffmpegBin, file) {
  try {
    const r = spawnSync(ffmpegBin, ['-i', file], { encoding: 'utf8', windowsHide: true })
    return /Stream #[^\n]*Audio:/.test((r.stderr || '') + (r.stdout || ''))
  } catch {
    return false
  }
}

function registerRenderIpc(getMainWindow) {
  registerAudioFolderWatch()

  ipcMain.handle('preset:list', async () => readPresets())

  ipcMain.handle('preset:save', async (_event, { name, data } = {}) => {
    if (!name || typeof name !== 'string') throw new Error('กรุณาระบุชื่อพรีเซ็ต')
    const presets = await readPresets()
    presets[name] = data
    await writePresets(presets)
    return presets
  })

  ipcMain.handle('preset:delete', async (_event, { name } = {}) => {
    if (!name || typeof name !== 'string') throw new Error('กรุณาระบุชื่อพรีเซ็ต')
    const presets = await readPresets()
    delete presets[name]
    await writePresets(presets)
    return presets
  })

  ipcMain.handle('render:get-preferred-encoder', async () => detectPreferredEncoder())

  /** วินิจฉัย encoder แบบเต็ม — probe NVENC จริง + เหตุผลถ้าใช้ GPU ไม่ได้
   *  ส่ง { refresh:true } เพื่อ probe ใหม่ (เช่น หลังผู้ใช้อัปเดตไดรเวอร์) */
  ipcMain.handle('render:diagnose-encoder', async (_event, payload) => {
    const refresh = !!(payload && payload.refresh)
    return diagnoseEncoder(refresh)
  })

  ipcMain.handle('fs:list-audio-files', async (_event, { folderPath } = {}) => {
    if (!folderPath || typeof folderPath !== 'string') throw new Error('กรุณาระบุเส้นทางโฟลเดอร์')
    if (!fs.existsSync(folderPath)) return []
    return listFilesByExt(folderPath, ['.wav', '.mp3', '.m4a'])
  })

  /** ตรวจ ffmpeg availability — ใช้สำหรับ status check ใน UI */
  ipcMain.handle('render:checkFfmpeg', async () => {
    try {
      if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
        return { ok: false, error: `ffmpeg not found at ${ffmpegPath || '(unknown)'}` }
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

  ipcMain.handle('render:cancel-job', async (_event, { jobId } = {}) => {
    if (!jobId || !activeRenderJobs.has(jobId)) return { ok: false, cancelled: false }
    const job = activeRenderJobs.get(jobId)
    /** Graceful cancel — เขียน `q\n` ให้ ffmpeg แต่ละตัว finalize muxer (ไฟล์ .mp4
     *  บางส่วนยังเล่นได้) แล้วออก; stopFfmpegChild fallback เป็น SIGKILL อัตโนมัติ
     *  ถ้าไม่ยอมออกใน GRACEFUL_QUIT_TIMEOUT_MS. ลบ jobId หลัง loop เพื่อให้ iteration
     *  ถัดไปเห็น has(jobId)=false (rejection จาก child ที่ถูกหยุดไหลกลับเข้า catch) */
    for (const child of job.children) {
      stopFfmpegChild(child, { reason: 'user-cancel' })
    }
    activeRenderJobs.delete(jobId)
    return { ok: true, cancelled: true }
  })

  ipcMain.handle('render:start-batch-cover', async (event, payload = {}) => {
    const {
      jobId, imagePath, audioFolder, outputFolder, coverFolder,
      useMultipleCovers, titlePrefix = '', encodeOption, crfValue,
      resolutionLabel, overwriteMode = 'ask', selectedAudioFiles,
      doneFolder: doneFolderPayload,
      introPath: introPathPayload = '',
      introClipPath: introClipPathPayload = '', // legacy alias
    } = payload

    if (!jobId || typeof jobId !== 'string') throw new Error('กรุณาระบุรหัสงาน')
    if (!audioFolder || !outputFolder) throw new Error('กรุณาเลือกโฟลเดอร์เสียงและโฟลเดอร์ปลายทาง')
    if (!useMultipleCovers && !imagePath) throw new Error('กรุณาเลือกภาพปก')
    if (useMultipleCovers && !coverFolder) throw new Error('กรุณาเลือกโฟลเดอร์ภาพปก')

    /** intro: optional — รับทั้ง introPath และ introClipPath เพื่อ backward compat
     *  รองรับ 2 ชนิด (ต้อง sync กับ INTRO_*_EXTENSIONS ฝั่ง renderer/renderConstants.ts):
     *    video → เอามาต่อหน้าสุด (concat ระดับวิดีโอ, 2-stage)
     *    audio → merge เสียง intro + เสียงตอน ใช้ปกตอนตลอดคลิป (single-pass) */
    const INTRO_VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi'])
    const INTRO_AUDIO_EXTS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus'])
    const introCandidate = introPathPayload || introClipPathPayload
    const introPath = typeof introCandidate === 'string' && introCandidate.trim() ? introCandidate.trim() : ''
    const introExt = introPath ? path.extname(introPath).toLowerCase() : ''
    const introKind = INTRO_VIDEO_EXTS.has(introExt) ? 'video' : INTRO_AUDIO_EXTS.has(introExt) ? 'audio' : 'unknown'
    const useIntroValid = Boolean(introPath) && fs.existsSync(introPath) && introKind !== 'unknown'
    /** เฉพาะวิดีโอที่ต้อง render chapter เป็น temp ก่อนแล้วค่อย concat — เสียง render รวบเดียว */
    const needsConcatStage = useIntroValid && introKind === 'video'
    if (introPath && !useIntroValid) {
      const reason = !fs.existsSync(introPath)
        ? `ไม่พบไฟล์ intro "${introPath}"`
        : `ชนิดไฟล์ intro ไม่รองรับ "${introExt}"`
      event.sender.send('render:progress', {
        jobId, phase: 'intro', progress: 0,
        message: `เตือน: ${reason} — จะเรนเดอร์โดยไม่แทรก intro`,
      })
    }

    const resolutionMap = {
      '144p': '256:144',
      '240p': '426:240',
      '360p': '640:360',
      '480p': '854:480',
      '720p': '1280:720',
      '1080p': '1920:1080',
    }
    const selectedResolution = resolutionMap[resolutionLabel] ?? resolutionMap['240p']
    const VALID_ENCODERS = new Set([
      'NVENC (H.264)', 'NVIDIA NVENC (H.264)', 'NVENC (H.265)',
      'VideoToolbox (H.264)', 'VideoToolbox (H.265)', 'Software (H.264)',
    ])
    const finalEncodeOption = VALID_ENCODERS.has(encodeOption) ? encodeOption : await detectPreferredEncoder()
    /** อาจถูกดาวน์เกรดเป็น Software กลางคัน ถ้า HW encoder เปิดไม่ได้บนเครื่องนั้น */
    let videoEncodeOption = finalEncodeOption
    const effectiveCrf = Number(crfValue)

    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) throw new Error('ไม่พบ FFmpeg ในโปรแกรม')
    if (!fs.existsSync(audioFolder)) throw new Error('ไม่พบโฟลเดอร์เสียง')
    if (!fs.existsSync(outputFolder)) await fsp.mkdir(outputFolder, { recursive: true })
    if (!useMultipleCovers && !fs.existsSync(imagePath)) throw new Error(`ไม่พบภาพปก: ${imagePath}`)
    if (useMultipleCovers && !fs.existsSync(coverFolder)) throw new Error(`ไม่พบโฟลเดอร์ภาพปก: ${coverFolder}`)

    let audioFiles = listFilesByExt(audioFolder, ['.wav', '.mp3', '.m4a'])
    if (Array.isArray(selectedAudioFiles)) {
      const selectedSet = new Set(
        selectedAudioFiles.filter((n) => typeof n === 'string').map((n) => n.trim()).filter(Boolean)
      )
      if (selectedSet.size === 0) throw new Error('กรุณาเลือกไฟล์เสียงอย่างน้อย 1 ไฟล์')
      audioFiles = audioFiles.filter((n) => selectedSet.has(n))
    }
    if (audioFiles.length === 0) throw new Error('ไม่พบไฟล์เสียง .wav / .mp3 / .m4a ที่ตรงกับรายการที่เลือก')

    stopAllFfmpegAndRenderJobs()

    /** doneFolder: ถ้า user ส่ง path มา ใช้เลย — ไม่งั้น default `<audioFolder>/processed` */
    const doneFolder = typeof doneFolderPayload === 'string' && doneFolderPayload
      ? doneFolderPayload
      : path.join(audioFolder, 'processed')
    await fsp.mkdir(doneFolder, { recursive: true })

    const coverIndex = useMultipleCovers ? buildCoverIndex(coverFolder) : null
    const missingCovers = []
    let successCount = 0
    let skippedCount = 0
    const fileTimes = []
    const errorLogPath = path.join(app.getPath('userData'), 'rendering_errors.log')
    const startedAt = Date.now()
    let overwriteAll = overwriteMode === 'replace_all' || overwriteMode === 'overwrite'
      ? true
      : overwriteMode === 'skip_all' || overwriteMode === 'skip'
        ? false
        : null
    const childSet = new Set()
    activeRenderJobs.set(jobId, { children: childSet })
    /** ไฟล์ temp ที่ต้อง clean ไม่ว่าจะ success/fail/cancel — เก็บไว้ cleanup ที่ outer finally */
    const tempFilesToCleanup = new Set()

    try {
      /** intro วิดีโอที่ไม่มีแทร็กเสียง → concat ที่อ้าง [0:a] จะล้มเหลว
       *  เติมเสียงเงียบ (anullsrc) ให้ intro หนึ่งครั้งก่อนเข้าลูป แล้วใช้ไฟล์นั้น concat
       *  (intro ที่มีเสียงอยู่แล้ว = ใช้ตรง ๆ ไม่แตะ เพื่อคงเสียง intro เดิม) */
      let concatIntroPath = introPath
      if (needsConcatStage && !ffmpegInputHasAudio(ffmpegPath, introPath)) {
        const silentIntro = path.join(outputFolder, '.intro.silentaudio.mp4')
        tempFilesToCleanup.add(silentIntro)
        event.sender.send('render:progress', {
          jobId, phase: 'intro', progress: 0,
          message: 'วิดีโอเปิดไม่มีเสียง — เพิ่มแทร็กเสียงเงียบให้อัตโนมัติ',
        })
        const normResult = await runFfmpegWithTimeParsing(ffmpegPath, [
          '-y', '-i', introPath,
          '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-map', '0:v', '-map', '1:a',
          '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', silentIntro,
        ], {
          registerChild: (child) => childSet.add(child),
          unregisterChild: (child) => childSet.delete(child),
        })
        if (normResult && normResult.cancelled) throw new Error('ยกเลิกการเรนเดอร์แล้ว')
        concatIntroPath = silentIntro
      }

      for (let index = 0; index < audioFiles.length; index++) {
        if (!activeRenderJobs.has(jobId)) throw new Error('ยกเลิกการเรนเดอร์แล้ว')
        const audioFile = audioFiles[index]
        const fileStartTime = Date.now()
        const audioPath = path.join(audioFolder, audioFile)
        const audioBase = path.parse(audioFile).name

        let outputFilename = `${audioBase}.mp4`
        const cleanPrefix = String(titlePrefix).replace(/^\s+/, '')
        if (cleanPrefix) {
          const numbers = extractNumberOrRanges(audioBase)
          const numberPart = numbers.length > 0 ? numbers.sort((a, b) => b.length - a.length)[0] : audioBase
          outputFilename = `${cleanPrefix}${numberPart}.mp4`
        }
        const outputFile = path.join(outputFolder, outputFilename)

        let coverImage = imagePath
        if (useMultipleCovers) {
          coverImage = matchCoverForAudio(audioFile, coverFolder, coverIndex)
          if (!coverImage || !fs.existsSync(coverImage)) {
            missingCovers.push(audioFile)
            await safeAttemptAsync('move audio → done (skip)', () => fsp.rename(audioPath, path.join(doneFolder, audioFile)))
            event.sender.send('render:progress', {
              jobId, phase: 'จับคู่ภาพปก', progress: index / audioFiles.length,
              message: `ข้าม ${audioFile} เนื่องจากไม่พบภาพปกที่ตรงกัน`,
            })
            continue
          }
        }

        if (fs.existsSync(outputFile)) {
          if (overwriteAll === null) {
            const mainWin = getMainWindow ? getMainWindow() : BrowserWindow.getFocusedWindow()
            if (!mainWin) {
              /** no window to prompt — default skip */
              overwriteAll = false
            } else {
              const response = await dialog.showMessageBox(mainWin, {
                type: 'warning',
                buttons: ['แทนที่ไฟล์นี้และไฟล์ถัดไปทั้งหมด', 'ข้ามไฟล์นี้และไฟล์ที่ซ้ำถัดไปทั้งหมด', 'ยกเลิก'],
                defaultId: 0, cancelId: 2,
                title: 'พบไฟล์ปลายทางที่มีอยู่แล้ว',
                message: `ไฟล์ ${path.basename(outputFile)} มีอยู่แล้ว`,
                detail: 'กรุณาเลือกวิธีจัดการไฟล์ที่ซ้ำกัน',
              })
              if (response.response === 0) overwriteAll = true
              if (response.response === 1 || response.response === 2) overwriteAll = false
            }
          }
          if (overwriteAll === false) {
            skippedCount += 1
            await safeAttemptAsync('move audio → done (skip)', () => fsp.rename(audioPath, path.join(doneFolder, audioFile)))
            continue
          }
        }

        const baseFilePercent = (index / audioFiles.length) * 100
        event.sender.send('render:progress', {
          jobId, phase: 'เรนเดอร์', progress: index / audioFiles.length,
          message: `กำลังเรนเดอร์ไฟล์ที่ ${index + 1} จาก ${audioFiles.length}: ${audioFile}`,
          fileName: audioFile, overallPercent: baseFilePercent,
        })

        let duration = 0
        let currentTime = 0
        /** วิดีโอ intro = render chapter ไป temp ก่อน แล้วค่อย concat กับวิดีโอ
         *  เสียง intro / ไม่มี intro = render ตรงเข้า outputFile (เสียงถูก merge ใน pass เดียว) */
        const chapterOutFile = needsConcatStage
          ? path.join(outputFolder, `.${path.parse(outputFilename).name}.chapter.mp4`)
          : outputFile
        if (needsConcatStage) tempFilesToCleanup.add(chapterOutFile)

        const chapterFfmpegHooks = {
          registerChild: (child) => childSet.add(child),
          unregisterChild: (child) => childSet.delete(child),
          onTimeLine: (text) => {
            const durationMatch = text.match(/Duration:\s(\d{2}:\d{2}:\d{2}\.\d{2})/)
            if (durationMatch) duration = parseTime(durationMatch[1])
            const timeMatch = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
            if (timeMatch) {
              currentTime = parseTime(timeMatch[1])
              if (duration > 0) {
                const fileProgressPercent = Math.min(100, (currentTime / duration) * 100)
                const overallProgress = baseFilePercent + fileProgressPercent / audioFiles.length
                const elapsedFileTime = (Date.now() - fileStartTime) / 1000
                const speed = currentTime > 0 && elapsedFileTime > 0 ? currentTime / elapsedFileTime : 0
                const remainingFileTime = speed > 0 ? (duration - currentTime) / speed : 0
                const avgTimePerFile =
                  fileTimes.length > 0 ? fileTimes.reduce((a, b) => a + b, 0) / fileTimes.length : elapsedFileTime
                const etaSeconds = remainingFileTime + avgTimePerFile * (audioFiles.length - (index + 1))
                event.sender.send('render:progress', {
                  jobId, phase: 'เรนเดอร์', progress: Math.min(1, overallProgress / 100),
                  message: `กำลังเรนเดอร์ ${audioFile}`, fileName: audioFile,
                  fileProgressPercent, overallPercent: overallProgress,
                  currentTimeText: formatTime(currentTime), durationText: formatTime(duration),
                  etaText: formatTime(etaSeconds),
                })
              }
            }
          },
        }

        /** เรนเดอร์ 1 ตอน — แยกเป็นฟังก์ชันเพื่อใช้ retry ตอน fallback เป็น CPU
         *  - intro เสียง: loop ปก + concat(เสียง intro, เสียงตอน) ใน pass เดียว (ปกตลอดคลิป)
         *  - อื่น ๆ: loop ปก + เสียงตอน ตามปกติ */
        const renderChapter = (encodeArgs) => {
          if (useIntroValid && introKind === 'audio') {
            return runFfmpegWithTimeParsing(ffmpegPath, [
              '-y', '-loop', '1', '-i', coverImage, '-i', introPath, '-i', audioPath,
              '-filter_complex',
              `[1:a]aformat=sample_rates=44100:channel_layouts=stereo[ia];` +
              `[2:a]aformat=sample_rates=44100:channel_layouts=stereo[ca];` +
              `[ia][ca]concat=n=2:v=0:a=1[aout]`,
              '-map', '0:v', '-map', '[aout]',
              '-vf', `scale=${selectedResolution}`, '-r', '1',
              ...encodeArgs,
              '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p', '-shortest', chapterOutFile,
            ], chapterFfmpegHooks)
          }
          return runFfmpegWithTimeParsing(ffmpegPath, [
            '-y', '-loop', '1', '-i', coverImage, '-i', audioPath,
            '-vf', `scale=${selectedResolution}`, '-r', '1',
            ...encodeArgs,
            '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p', '-shortest', chapterOutFile,
          ], chapterFfmpegHooks)
        }

        let chapterResult
        try {
          chapterResult = await renderChapter(buildVideoEncodeArgs(videoEncodeOption, effectiveCrf))
        } catch (err) {
          /** HW encoder (NVENC/VideoToolbox) เปิดไม่ได้บนเครื่องนี้ — ถอยไปใช้ CPU
           *  ซึ่งใช้ได้ทุกเครื่องทุก OS. ถ้าเป็น Software อยู่แล้ว หรืองานถูกยกเลิก
           *  = error จริง ให้โยนต่อ */
          if (videoEncodeOption === 'Software (H.264)' || !activeRenderJobs.has(jobId)) throw err
          videoEncodeOption = 'Software (H.264)'
          await safeAttemptAsync('log hw-encoder fallback', () =>
            fsp.appendFile(
              errorLogPath,
              `คำเตือน: ใช้ฮาร์ดแวร์เรนเดอร์ไม่ได้ — เปลี่ยนไปใช้ CPU: ${err instanceof Error ? err.message : String(err)}${os.EOL}`,
              'utf8'
            )
          )
          event.sender.send('render:progress', {
            jobId, phase: 'เรนเดอร์', progress: index / audioFiles.length,
            message: 'การ์ดจอเรนเดอร์ไม่ได้ — รอบนี้ใช้ CPU แทน (ลองอัปเดตไดรเวอร์การ์ดจอ NVIDIA แล้วเรนเดอร์ใหม่)',
            fileName: audioFile, overallPercent: baseFilePercent,
          })
          duration = 0
          currentTime = 0
          chapterResult = await renderChapter(buildVideoEncodeArgs(videoEncodeOption, effectiveCrf))
        }

        /** Graceful cancel — user กด "หยุด" ตอน chapter นี้กำลัง encode: helper
         *  resolve {cancelled:true} (ไฟล์ถูก finalize แล้ว เล่นได้) แทน reject →
         *  อย่านับ success, อย่าย้ายไฟล์เสียงต้นทาง, ออกจากลูปอย่างสะอาด */
        if (chapterResult && chapterResult.cancelled) {
          throw new Error('ยกเลิกการเรนเดอร์แล้ว')
        }

        /** ขั้นที่ 2: concat วิดีโอ intro + chapter → outputFile (เฉพาะ intro ชนิดวิดีโอ)
         *  เสียง intro merge ไปแล้วใน renderChapter จึงข้ามขั้นนี้ */
        if (needsConcatStage) {
          event.sender.send('render:progress', {
            jobId, phase: 'intro', progress: Math.min(1, (baseFilePercent + 100 / audioFiles.length * 0.9) / 100),
            message: `รวม intro กับ ${audioFile}`, fileName: audioFile,
          })
          const [wRes, hRes] = String(selectedResolution).split(':')
          const introResult = await runFfmpegWithTimeParsing(ffmpegPath, [
            '-y', '-i', concatIntroPath, '-i', chapterOutFile,
            '-filter_complex',
            `[0:v]scale=${wRes}:${hRes}:force_original_aspect_ratio=decrease,pad=${wRes}:${hRes}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=1[v0];` +
            `[1:v]scale=${wRes}:${hRes}:force_original_aspect_ratio=decrease,pad=${wRes}:${hRes}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=1[v1];` +
            `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];` +
            `[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];` +
            `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
            '-map', '[v]', '-map', '[a]',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(Number.isFinite(effectiveCrf) ? effectiveCrf : 30),
            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
            '-movflags', '+faststart', outputFile,
          ], {
            registerChild: (child) => childSet.add(child),
            unregisterChild: (child) => childSet.delete(child),
          })
          if (introResult && introResult.cancelled) {
            throw new Error('ยกเลิกการเรนเดอร์แล้ว')
          }
          await safeAttemptAsync('unlink chapter temp (success)', () => fsp.unlink(chapterOutFile))
          tempFilesToCleanup.delete(chapterOutFile)
        }

        successCount += 1
        fileTimes.push((Date.now() - fileStartTime) / 1000)
        try { await fsp.rename(audioPath, path.join(doneFolder, audioFile)) } catch (e) {
          await fsp.appendFile(errorLogPath, `คำเตือน: ไม่สามารถย้าย ${audioFile}: ${String(e)}${os.EOL}`, 'utf8')
        }
      }

      const elapsedSeconds = (Date.now() - startedAt) / 1000
      const summary = {
        successCount, totalFiles: audioFiles.length, elapsedSeconds,
        skippedCount, missingCovers, encoder: videoEncodeOption, resolutionLabel,
      }
      event.sender.send('render:progress', {
        jobId, phase: 'เสร็จสมบูรณ์', progress: 1, message: 'การเรนเดอร์เสร็จสมบูรณ์แล้ว', summary,
      })
      return summary
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      /** User-cancel path — คืน summary (cancelled:true) แทนการ throw เพื่อไม่ให้
       *  renderer ขึ้น popup "error" ทั้งที่งานถูกบันทึกบางส่วนแล้ว (ตอนที่เสร็จก่อน
       *  cancel อยู่ใน output, ตอนที่กำลัง encode ถูก ffmpeg `q`-quit finalize ไว้) */
      const cancelled = message === 'ยกเลิกการเรนเดอร์แล้ว' || !activeRenderJobs.has(jobId)
      if (cancelled) {
        const elapsedSeconds = (Date.now() - startedAt) / 1000
        const summary = {
          successCount, totalFiles: audioFiles.length, elapsedSeconds,
          skippedCount, missingCovers, encoder: videoEncodeOption, resolutionLabel,
          cancelled: true,
        }
        event.sender.send('render:progress', {
          jobId, phase: 'ยกเลิก', progress: 1,
          message: `ยกเลิกแล้ว — บันทึก ${successCount} ไฟล์ที่เรนเดอร์เสร็จก่อนหน้า`,
          summary,
        })
        return summary
      }
      await fsp.appendFile(errorLogPath, `ข้อผิดพลาด: ${message}${os.EOL}`, 'utf8')
      throw e
    } finally {
      activeRenderJobs.delete(jobId)
      for (const tempPath of tempFilesToCleanup) {
        await safeAttemptAsync('unlink chapter temp (finally)', () => fsp.unlink(tempPath))
      }
    }
  })

  log.info('render IPC registered')
}

module.exports = { registerRenderIpc }
