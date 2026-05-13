/**
 * renderHelpers — pure helpers สำหรับ render.cjs
 *
 * แยกจาก render.cjs เพราะ render.cjs require('electron') ที่ test runner เปล่า ๆ ไม่มี
 * ที่นี่ไม่ require electron — test ได้ตรง ๆ
 */

/** map resolution label → {w, h} (default 720p) */
function formatRes(label) {
  switch (label) {
    case '480p': return { w: 854, h: 480 }
    case '720p': return { w: 1280, h: 720 }
    case '1080p': return { w: 1920, h: 1080 }
    default: return { w: 1280, h: 720 }
  }
}

/**
 * map encoder label → ffmpeg codec args (array)
 *   - 'NVENC (H.264)'  → h264_nvenc
 *   - 'NVENC (H.265)'  → hevc_nvenc
 *   - default          → libx264 software
 */
function encoderArgs(label, crf) {
  if (typeof label === 'string') {
    if (/nvenc.*265|hevc/iu.test(label)) {
      return ['-c:v', 'hevc_nvenc', '-preset', 'p5', '-cq', String(crf), '-rc', 'vbr']
    }
    if (/nvenc/iu.test(label)) {
      return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', String(crf), '-rc', 'vbr']
    }
  }
  return ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p']
}

/** parse "Duration: HH:MM:SS.xx" → seconds (null ถ้าไม่เจอ) */
function parseDuration(stderr) {
  const m = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}\.\d+)/u)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

/** parse "time=HH:MM:SS.xx" → seconds (null ถ้าไม่เจอ) */
function parseTime(line) {
  const m = line.match(/time=(\d+):(\d{2}):(\d{2}\.\d+)/u)
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function basename(p) {
  return p.split(/[\\/]/u).pop() || p
}

function nameWithoutExt(name) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

const IMAGE_EXTENSIONS_RE = /\.(png|jpe?g|webp)$/iu

/**
 * หาปกใน folder ที่ชื่อตรงกับ audio (ไม่นับ extension)
 *   audioBase: 'chapter-001.m4a' + folder มี 'chapter-001.png' → return path
 *   case-insensitive match
 */
function findMatchingCoverSync(coverFolder, audioBase, readdirSync) {
  if (!coverFolder || !audioBase) return null
  let entries
  try {
    entries = readdirSync(coverFolder)
  } catch {
    return null
  }
  const target = nameWithoutExt(audioBase).toLowerCase()
  const path = require('node:path')
  for (const name of entries) {
    if (!IMAGE_EXTENSIONS_RE.test(name)) continue
    if (nameWithoutExt(name).toLowerCase() === target) {
      return path.join(coverFolder, name)
    }
  }
  return null
}

module.exports = {
  formatRes,
  encoderArgs,
  parseDuration,
  parseTime,
  formatTime,
  basename,
  nameWithoutExt,
  findMatchingCoverSync,
  IMAGE_EXTENSIONS_RE,
}
