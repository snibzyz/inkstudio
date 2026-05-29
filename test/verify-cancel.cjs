'use strict'
/**
 * verify-cancel.cjs — พิสูจน์ว่า graceful cancel (เขียน `q\n` ให้ ffmpeg โดยไม่ปิด stdin)
 * ทำให้ไฟล์ที่กำลังเรนเดอร์ถูก finalize เป็น .mp4 ที่ "เล่นได้" (มี moov atom)
 *
 * นี่คือพฤติกรรมที่ stopFfmpegChild ใน renderHelpers.cjs ทำตอน user กด "หยุด"
 * (การ SIGKILL ตรง ๆ จะได้ไฟล์พังเล่นไม่ได้ — graceful q-quit ได้ partial ที่เล่นได้)
 *
 * รัน: node test/verify-cancel.cjs
 */
const { spawn, spawnSync } = require('child_process')
const { createRequire } = require('module')
const fs = require('fs')
const path = require('path')
const os = require('os')

const SHELL = path.resolve(__dirname, '..', '.app', 'shell')
const shellRequire = createRequire(path.join(SHELL, 'package.json'))
const ffmpeg = shellRequire('ffmpeg-static')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkstudio-cancel-'))
const f = (n) => path.join(dir, n)

function run(label, args) {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8' })
  if (r.status !== 0) { console.error(`[FAIL] ${label}\n${r.stderr?.slice(-1200)}`); process.exit(1) }
}
function probe(file) {
  const info = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8' }).stderr || ''
  const dm = info.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  const dur = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0
  const decode = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' })
  return { dur, playable: decode.status === 0 && !decode.stderr.trim() }
}

// input ยาว ~15s + ปก
run('gen cover.png', ['-y', '-f', 'lavfi', '-i', 'color=c=teal:s=320x180', '-frames:v', '1', f('cover.png')])
run('gen long.wav (15s)', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=15', f('long.wav')])

const out = f('partial.mp4')

// spawn ffmpeg แบบ realtime (-re) เพื่อให้เรนเดอร์ค่อย ๆ เดิน → หยุดกลางคันได้
// stdio: stdin=pipe (ส่ง q ได้), stderr=ignore
const child = spawn(ffmpeg, [
  '-re', '-loop', '1', '-i', f('cover.png'), '-re', '-i', f('long.wav'),
  '-vf', 'scale=256:144', '-r', '1',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p', '-shortest', '-y', out,
], { stdio: ['pipe', 'ignore', 'ignore'] })

const closed = new Promise((resolve) => child.once('close', (code) => resolve(code)))

// หลัง ~2.5s → เขียน `q\n` (graceful) โดย "ไม่" เรียก stdin.end() — เหมือน stopFfmpegChild
setTimeout(() => {
  try { if (child.stdin && child.stdin.writable) child.stdin.write('q\n') } catch { /* ignore */ }
}, 2500)

closed.then((code) => {
  const exists = fs.existsSync(out) && fs.statSync(out).size > 0
  const p = exists ? probe(out) : { dur: 0, playable: false }
  // partial ต้อง: มีไฟล์ + เล่นได้ + สั้นกว่าเต็ม (15s) แต่ > 0
  const partialOk = exists && p.playable && p.dur > 0 && p.dur < 14
  console.log('\n── graceful cancel ─────────────────────')
  console.log(`ffmpeg exit code        : ${code}`)
  console.log(`partial file exists     : ${exists} (${exists ? (fs.statSync(out).size / 1024).toFixed(1) + 'KB' : '-'})`)
  console.log(`partial duration        : ${p.dur.toFixed(2)}s (เต็ม=15s → ถูกตัดกลางคัน)`)
  console.log(`partial PLAYABLE        : ${p.playable}`)
  console.log(`${partialOk ? 'PASS' : 'FAIL'}  graceful q-quit → partial mp4 เล่นได้`)
  fs.rmSync(dir, { recursive: true, force: true })
  process.exit(partialOk ? 0 : 1)
})
