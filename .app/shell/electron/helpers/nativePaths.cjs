'use strict'
// nativePaths.cjs — resolve native binary paths (ffmpeg, ffprobe, ripgrep)
// ให้ใช้ได้ทั้ง dev + packaged build (Win/Mac/Linux)
//
// Packaged build: binary อยู่ใน app.asar.unpacked เพราะ spawn รัน asar ไม่ได้
//                 → rewrite path: ".../app.asar/..." → ".../app.asar.unpacked/..."
// Dev build:      path จาก require() ตรง ๆ ใช้ได้เลย (อยู่ใน node_modules ปกติ)

function unpackedPath(p) {
  if (!p) return p
  return p.replace(/[\\/]app\.asar[\\/]/, (m) => m.replace('app.asar', 'app.asar.unpacked'))
}

let _ffmpeg = null
function getFfmpegPath() {
  if (_ffmpeg !== null) return _ffmpeg
  try {
    const raw = require('ffmpeg-static')
    _ffmpeg = unpackedPath(raw)
  } catch (_) {
    _ffmpeg = null
  }
  return _ffmpeg
}

let _ffprobe = null
function getFfprobePath() {
  if (_ffprobe !== null) return _ffprobe
  try {
    const raw = require('ffprobe-static').path
    _ffprobe = unpackedPath(raw)
  } catch (_) {
    _ffprobe = null
  }
  return _ffprobe
}

let _rg = null
function getRipgrepPath() {
  if (_rg !== null) return _rg
  try {
    const raw = require('vscode-ripgrep').rgPath
    _rg = unpackedPath(raw)
  } catch (_) {
    _rg = null
  }
  return _rg
}

module.exports = {
  unpackedPath,
  getFfmpegPath,
  getFfprobePath,
  getRipgrepPath,
}
