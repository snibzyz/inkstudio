'use strict'
/**
 * verify-single-cover.cjs — end-to-end verify ของบั๊ก "โหมดปกเดียวสร้างวิดีโอไม่ได้"
 *
 * รันด้วย: node test/verify-single-cover.cjs   (จากโฟลเดอร์ .app/shell)
 *
 * พิสูจน์:
 *   A) payload แบบที่ shim "ที่แก้แล้ว" ส่ง (คีย์ imagePath, useMultipleCovers:false)
 *      → backend handler ตัวจริงเรนเดอร์ออกมาเป็น mp4 ที่ decode เล่นได้จริง
 *   B) payload แบบ "บั๊กเดิม" (คีย์ coverPath แทน imagePath)
 *      → handler throw 'กรุณาเลือกภาพปก' (ยืนยันว่านี่คือสาเหตุที่ปกเดียวเคยพัง)
 *
 * ไม่พึ่ง GUI/electron runtime — stub โมดูล 'electron' เพื่อ require render.cjs ภายใต้ node ล้วน
 */

const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawnSync } = require('child_process')
const Module = require('module')

const SHELL_DIR = path.resolve(__dirname, '..')
const ffmpegPath = require(path.join(SHELL_DIR, 'node_modules/ffmpeg-static'))

/* ─── stub 'electron' ก่อน require render.cjs ───────────────────────────── */
const registeredHandlers = {}
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inkstudio-verify-'))
const userDataDir = path.join(tmpRoot, 'userData')
fs.mkdirSync(userDataDir, { recursive: true })

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: { getPath: () => userDataDir },
      ipcMain: { handle: (channel, fn) => { registeredHandlers[channel] = fn } },
      dialog: { showMessageBox: async () => ({ response: 0 }) },
      BrowserWindow: { getFocusedWindow: () => null },
    }
  }
  return origLoad.apply(this, arguments)
}

const { registerRenderIpc } = require(path.join(SHELL_DIR, 'electron/ipc/render.cjs'))
registerRenderIpc(() => null)

const handler = registeredHandlers['render:start-batch-cover']
if (typeof handler !== 'function') {
  console.error('FAIL: ไม่พบ handler render:start-batch-cover')
  process.exit(1)
}

/* ─── helpers ───────────────────────────────────────────────────────────── */
function ff(args) {
  const r = spawnSync(ffmpegPath, args, { encoding: 'utf8', windowsHide: true })
  return r.status === 0
}
function isPlayable(mp4) {
  // decode ทั้งไฟล์ไปทิ้ง — exit 0 + ไม่มี error = ไฟล์สมบูรณ์ เล่นได้
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-i', mp4, '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true })
  return r.status === 0 && !(r.stderr || '').trim()
}
function makeFakeEvent(bucket) {
  return { sender: { send: (_ch, payload) => bucket.push(payload) } }
}

/* ─── สร้าง fixtures จริง ────────────────────────────────────────────────── */
const coverPng = path.join(tmpRoot, 'ปกอะไรก็ได้.png') // ตั้งใจใช้ชื่อไทย + ไม่มีเลข
const audioFolder = path.join(tmpRoot, 'audio')
const outputFolder = path.join(tmpRoot, 'out')
fs.mkdirSync(audioFolder, { recursive: true })
fs.mkdirSync(outputFolder, { recursive: true })

const okCover = ff(['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=640x360:d=1', '-frames:v', '1', coverPng])
const okA1 = ff(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', path.join(audioFolder, 'ตอนที่ 1.wav')])
const okA2 = ff(['-y', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=2', path.join(audioFolder, 'ตอนที่ 2.wav')])
if (!okCover || !okA1 || !okA2) {
  console.error('FAIL: สร้าง fixtures (รูป/เสียง) ด้วย ffmpeg ไม่สำเร็จ')
  process.exit(1)
}

/* ─── payload แบบที่ shim ตัวที่แก้แล้วประกอบ (single-cover mode) ─────────── */
function buildFixedShimPayload() {
  return {
    jobId: 'verify-fixed',
    imagePath: coverPng,            // ← คีย์ที่ถูกต้อง (หลังแก้)
    coverFolder: undefined,
    useMultipleCovers: false,
    audioFolder,
    selectedAudioFiles: ['ตอนที่ 1.wav', 'ตอนที่ 2.wav'],
    outputFolder,
    titlePrefix: 'ตอนที่ ',
    encodeOption: 'Software (H.264)', // universal — ไม่พึ่ง GPU
    crfValue: 51,
    resolutionLabel: '144p',
    overwriteMode: 'skip',
  }
}
/* ─── payload แบบบั๊กเดิม (ส่ง coverPath แทน imagePath) ───────────────────── */
function buildBuggyShimPayload() {
  const p = buildFixedShimPayload()
  p.jobId = 'verify-buggy'
  delete p.imagePath
  p.coverPath = coverPng          // ← คีย์เดิมที่ backend ไม่อ่าน
  return p
}

/* ─── run ───────────────────────────────────────────────────────────────── */
;(async () => {
  let failures = 0

  // ── A) fixed payload → ต้องได้ mp4 เล่นได้ครบ ──
  console.log('\n[A] payload หลังแก้ (imagePath, ปกเดียว) → คาดว่าเรนเดอร์ได้')
  const evA = []
  try {
    const summary = await handler(makeFakeEvent(evA), buildFixedShimPayload())
    const expected = ['ตอนที่ 1.mp4', 'ตอนที่ 2.mp4'].map((f) => path.join(outputFolder, f))
    const allExist = expected.every((f) => fs.existsSync(f))
    const allPlay = expected.every((f) => fs.existsSync(f) && isPlayable(f))
    console.log('    summary:', JSON.stringify(summary))
    console.log('    ไฟล์ที่คาดหวัง:', expected.map((f) => path.basename(f)).join(', '))
    console.log('    มีไฟล์ครบ:', allExist, '| decode เล่นได้ครบ:', allPlay)
    if (summary.successCount !== 2) { console.error('    ✗ successCount ควร = 2'); failures++ }
    if (!allExist) { console.error('    ✗ ไฟล์ mp4 ไม่ครบ'); failures++ }
    if (!allPlay) { console.error('    ✗ มีไฟล์ที่ decode ไม่ผ่าน'); failures++ }
    if (summary.successCount === 2 && allExist && allPlay) console.log('    ✓ PASS — ปกเดียว render ออก mp4 เล่นได้จริง 2/2')
  } catch (e) {
    console.error('    ✗ FAIL — handler throw:', e && e.message)
    failures++
  }

  // ── B) buggy payload → ต้อง throw 'กรุณาเลือกภาพปก' ──
  console.log('\n[B] payload บั๊กเดิม (coverPath แทน imagePath) → คาดว่า throw "กรุณาเลือกภาพปก"')
  const evB = []
  try {
    await handler(makeFakeEvent(evB), buildBuggyShimPayload())
    console.error('    ✗ FAIL — handler ไม่ throw (บั๊กควรทำให้ throw)')
    failures++
  } catch (e) {
    const msg = e && e.message
    if (msg === 'กรุณาเลือกภาพปก') {
      console.log('    ✓ PASS — ยืนยันว่าคีย์ coverPath = สาเหตุที่ปกเดียวเคยพัง (throw:', msg + ')')
    } else {
      console.error('    ✗ throw ข้อความอื่น:', msg)
      failures++
    }
  }

  // cleanup
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ }

  console.log('\n────────────────────────────')
  if (failures === 0) {
    console.log('RESULT: ✅ ผ่านทั้งหมด — โหมดปกเดียวใช้งานได้จริงหลังแก้ shim')
    process.exit(0)
  } else {
    console.log(`RESULT: ❌ ล้มเหลว ${failures} จุด`)
    process.exit(1)
  }
})()
