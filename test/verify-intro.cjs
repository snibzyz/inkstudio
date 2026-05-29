'use strict'
/**
 * verify-intro.cjs — พิสูจน์ว่า ffmpeg arg arrays ใน render.cjs ใช้งานได้จริง
 * รันด้วย ffmpeg/ffprobe ตัวจริง (ffmpeg-static / ffprobe-static) บน input ทดสอบ
 * ครอบ 3 เคส: ไม่มี intro / intro เสียง / intro วิดีโอ
 *
 * รันจาก .app/shell:  node ../../test/verify-intro.cjs
 */
const { spawnSync } = require('child_process')
const { createRequire } = require('module')
const fs = require('fs')
const path = require('path')
const os = require('os')

// resolve ffmpeg-static จาก node_modules ของ .app/shell (เหมือน getFfmpegPath())
const SHELL = path.resolve(__dirname, '..', '.app', 'shell')
const shellRequire = createRequire(path.join(SHELL, 'package.json'))
const ffmpeg = shellRequire('ffmpeg-static')
console.log('ffmpeg :', ffmpeg)

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkstudio-intro-'))
const f = (n) => path.join(dir, n)

function run(label, args, bin = ffmpeg) {
  const r = spawnSync(bin, args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(`\n[FAIL] ${label} (exit ${r.status})`)
    console.error(r.stderr?.slice(-1500))
    process.exit(1)
  }
  return r
}

function probe(file) {
  // (1) อ่าน metadata: ffmpeg -i พิมพ์ Duration + Stream ไป stderr (exit 1 = ปกติ ไม่มี output)
  const info = spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8' }).stderr || ''
  const dm = info.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  const dur = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0
  const hasVideo = /Stream #[^\n]*Video:/.test(info)
  const hasAudio = /Stream #[^\n]*Audio:/.test(info)
  // (2) พิสูจน์ว่าเล่นได้จริง: decode ทั้งไฟล์ → null ต้อง exit 0 + ไม่มี error
  const decode = spawnSync(ffmpeg, ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' })
  const playable = decode.status === 0 && !decode.stderr.trim()
  return { dur, hasVideo, hasAudio, playable }
}

const RES = '256:144'
const ENC = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30'] // buildVideoEncodeArgs('Software (H.264)', 30)

// ── สร้าง input ทดสอบ ───────────────────────────────────────────
run('gen cover.png', ['-y', '-f', 'lavfi', '-i', 'color=c=navy:s=320x180', '-frames:v', '1', f('cover.png')])
run('gen chapter.wav (3s)', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', f('chapter.wav')])
run('gen intro.wav (1s)', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', f('intro.wav')])
run('gen introvideo.mp4 (2s)', [
  '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x180:rate=25',
  '-f', 'lavfi', '-i', 'sine=frequency=660:duration=2', '-shortest',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f('introvideo.mp4'),
])

// ── เคส 1: ไม่มี intro (cover + เสียงตอน) ───────────────────────
const outNormal = f('out_normal.mp4')
run('render NORMAL', [
  '-y', '-loop', '1', '-i', f('cover.png'), '-i', f('chapter.wav'),
  '-vf', `scale=${RES}`, '-r', '1', ...ENC,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p', '-shortest', outNormal,
])

// ── เคส 2: intro เสียง (single-pass, ปกตลอดคลิป) ────────────────
const outAudio = f('out_audio_intro.mp4')
run('render AUDIO-INTRO', [
  '-y', '-loop', '1', '-i', f('cover.png'), '-i', f('intro.wav'), '-i', f('chapter.wav'),
  '-filter_complex',
  `[1:a]aformat=sample_rates=44100:channel_layouts=stereo[ia];` +
  `[2:a]aformat=sample_rates=44100:channel_layouts=stereo[ca];` +
  `[ia][ca]concat=n=2:v=0:a=1[aout]`,
  '-map', '0:v', '-map', '[aout]',
  '-vf', `scale=${RES}`, '-r', '1', ...ENC,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p', '-shortest', outAudio,
])

// ── เคส 3: intro วิดีโอ (2-stage) ───────────────────────────────
const chapterTemp = f('.chapter.tmp.mp4')
run('render VIDEO-INTRO stage1', [
  '-y', '-loop', '1', '-i', f('cover.png'), '-i', f('chapter.wav'),
  '-vf', `scale=${RES}`, '-r', '1', ...ENC,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p', '-shortest', chapterTemp,
])
const outVideo = f('out_video_intro.mp4')
const [wRes, hRes] = RES.split(':')
run('render VIDEO-INTRO stage2 (concat)', [
  '-y', '-i', f('introvideo.mp4'), '-i', chapterTemp,
  '-filter_complex',
  `[0:v]scale=${wRes}:${hRes}:force_original_aspect_ratio=decrease,pad=${wRes}:${hRes}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=1[v0];` +
  `[1:v]scale=${wRes}:${hRes}:force_original_aspect_ratio=decrease,pad=${wRes}:${hRes}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=1[v1];` +
  `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];` +
  `[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];` +
  `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
  '-movflags', '+faststart', outVideo,
])

// ── เคส 4: intro วิดีโอเงียบ (ไม่มี audio track) → normalize + concat ──
// 4a) สร้างวิดีโอที่ไม่มีเสียง
const silentVid = f('introvideo_silent.mp4')
run('gen introvideo_silent.mp4 (2s · no audio)', [
  '-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x180:rate=25',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', silentVid,
])
function hasAudioTrack(file) {
  const txt = (spawnSync(ffmpeg, ['-i', file], { encoding: 'utf8' }).stderr || '')
  return /Stream #[^\n]*Audio:/.test(txt)
}
const silentHasAudio = hasAudioTrack(silentVid) // ควร false (พิสูจน์ว่าต้อง normalize)
// 4b) normalize: เติม anullsrc (เหมือน render.cjs)
const normIntro = f('.intro.silentaudio.mp4')
run('normalize silent intro (+anullsrc)', [
  '-y', '-i', silentVid,
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', normIntro,
])
const normHasAudio = hasAudioTrack(normIntro) // ควร true หลัง normalize
// 4c) concat ด้วย intro ที่ normalize แล้ว (ใช้ chapterTemp เดิม)
const outSilentVideo = f('out_silent_video_intro.mp4')
run('render SILENT-VIDEO-INTRO concat', [
  '-y', '-i', normIntro, '-i', chapterTemp,
  '-filter_complex',
  `[0:v]scale=${wRes}:${hRes}:force_original_aspect_ratio=decrease,pad=${wRes}:${hRes}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=1[v0];` +
  `[1:v]scale=${wRes}:${hRes}:force_original_aspect_ratio=decrease,pad=${wRes}:${hRes}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=1[v1];` +
  `[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0];` +
  `[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1];` +
  `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
  '-movflags', '+faststart', outSilentVideo,
])

console.log('\n── precondition (silent-video) ─────────')
console.log(`${silentHasAudio === false ? 'PASS' : 'FAIL'}  วิดีโอเงียบไม่มี audio track (silentHasAudio=${silentHasAudio})`)
console.log(`${normHasAudio === true ? 'PASS' : 'FAIL'}  หลัง normalize มี audio track (normHasAudio=${normHasAudio})`)

// ── ตรวจผล ─────────────────────────────────────────────────────
const checks = [
  { name: 'NORMAL (no intro)', file: outNormal, expDur: 3, tol: 1.0 },
  { name: 'AUDIO-INTRO (1s+3s=4s)', file: outAudio, expDur: 4, tol: 1.0 },
  { name: 'VIDEO-INTRO (2s+3s=5s)', file: outVideo, expDur: 5, tol: 1.5 },
  { name: 'SILENT-VIDEO-INTRO (2s+3s=5s)', file: outSilentVideo, expDur: 5, tol: 1.5 },
]
console.log('\n── results ─────────────────────────────')
let allOk = silentHasAudio === false && normHasAudio === true
for (const c of checks) {
  const p = probe(c.file)
  const sizeKb = (fs.statSync(c.file).size / 1024).toFixed(1)
  const durOk = Math.abs(p.dur - c.expDur) <= c.tol
  const ok = p.hasVideo && p.hasAudio && durOk && p.playable && fs.statSync(c.file).size > 0
  allOk = allOk && ok
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(24)} dur=${p.dur.toFixed(2)}s ` +
    `(exp~${c.expDur}s) v=${p.hasVideo} a=${p.hasAudio} playable=${p.playable} ${sizeKb}KB`
  )
}

fs.rmSync(dir, { recursive: true, force: true })
console.log(allOk ? `\nALL PASS — playable mp4 ทั้ง ${checks.length} เคส` : '\nSOME FAILED')
process.exit(allOk ? 0 : 1)
