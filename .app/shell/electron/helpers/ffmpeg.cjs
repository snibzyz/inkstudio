// ffmpeg.cjs — resolve ffmpeg-static path ให้ใช้ได้ทั้ง dev + packaged
//
// Packaged ผ่าน electron-builder ต้องตั้ง asarUnpack สำหรับ node_modules/ffmpeg-static
// เพราะ binary ต้อง exec ได้ — รันจากใน asar ไม่ได้
//
// ใน dev: ใช้ path จาก require('ffmpeg-static') ตรง ๆ
// ใน packaged: เปลี่ยน `app.asar` → `app.asar.unpacked` ใน path

const fs = require('node:fs')
const path = require('node:path')

let _cached = null

function resolveFfmpegPath() {
  if (_cached) return _cached

  let p = require('ffmpeg-static')
  if (!p) throw new Error('ffmpeg-static returned empty path')

  // ใน packaged build: rewrite app.asar → app.asar.unpacked
  if (p.includes(`${path.sep}app.asar${path.sep}`)) {
    p = p.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
  } else if (p.includes('/app.asar/')) {
    p = p.replace('/app.asar/', '/app.asar.unpacked/')
  }

  if (!fs.existsSync(p)) {
    // last resort — เผื่อ packaging ผิด ให้ throw ชัด ๆ
    throw new Error(`ffmpeg binary not found at: ${p}`)
  }

  _cached = p
  return p
}

module.exports = { resolveFfmpegPath }
