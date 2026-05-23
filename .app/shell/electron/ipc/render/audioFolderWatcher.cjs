'use strict'
/**
 * audioFolderWatcher — เฝ้าดูโฟลเดอร์เสียงของเครื่องมือคลิป (watcher-based, push)
 *
 * หลักการแบบ VS Code Explorer: ไม่ poll — `fs.watch` โฟลเดอร์เสียงที่ active อยู่
 * ตัวเดียว แล้ว push event `render:audio-folder-changed` เข้า renderer
 * (debounce กัน event ถี่ตอนไฟล์ถูกย้าย/สร้างเป็นชุด)
 *
 * IPC:
 *   - render:watch-audio-folder    { folderPath }  → เริ่ม/เปลี่ยนโฟลเดอร์ที่เฝ้าดู
 *   - render:unwatch-audio-folder                  → หยุดเฝ้าดู
 * Push:
 *   - render:audio-folder-changed  { folderPath }  → renderer โหลดรายการตอนใหม่
 *
 * เฝ้าดูได้ครั้งละ 1 โฟลเดอร์ (โฟลเดอร์เสียงของโปรเจกต์ที่กำลังใช้) — เปลี่ยนโฟลเดอร์
 * = ปิด watcher เก่าแล้วเปิดใหม่
 */

const { ipcMain, BrowserWindow } = require('electron')
const fs = require('fs')

/** สนใจเฉพาะไฟล์เสียงที่เครื่องมือคลิปรองรับ — ตรงกับ listFilesByExt ใน renderHelpers */
const AUDIO_EXT_RE = /\.(wav|mp3|m4a)$/i
const DEBOUNCE_MS = 400

let audioWatcher = null
let watchedFolder = ''
let debounceTimer = null

function stopAudioFolderWatch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (audioWatcher) {
    try { audioWatcher.close() } catch { /* ignore */ }
    audioWatcher = null
  }
  watchedFolder = ''
}

function broadcastAudioFolderChanged(folderPath) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send('render:audio-folder-changed', { folderPath }) } catch { /* ignore */ }
  }
}

function startAudioFolderWatch(folderPath) {
  /** เฝ้าดูโฟลเดอร์เดิมอยู่แล้ว — ไม่ต้องเปิด watcher ซ้ำ */
  if (folderPath && watchedFolder === folderPath && audioWatcher) return true
  stopAudioFolderWatch()
  if (!folderPath || typeof folderPath !== 'string' || !fs.existsSync(folderPath)) return false
  try {
    audioWatcher = fs.watch(folderPath, { recursive: false, persistent: false }, (_eventType, filename) => {
      /** filename อาจเป็น null บางระบบ — ถ้า null ก็ปล่อยผ่าน (refresh เผื่อไว้)
       *  ถ้ามีชื่อ ให้สนใจเฉพาะไฟล์เสียง กัน event จากไฟล์อื่นในโฟลเดอร์ */
      if (filename && !AUDIO_EXT_RE.test(String(filename))) return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        broadcastAudioFolderChanged(folderPath)
      }, DEBOUNCE_MS)
    })
    watchedFolder = folderPath
    return true
  } catch {
    audioWatcher = null
    watchedFolder = ''
    return false
  }
}

function register() {
  ipcMain.handle('render:watch-audio-folder', (_event, { folderPath } = {}) => {
    return { watching: startAudioFolderWatch(folderPath) }
  })
  ipcMain.handle('render:unwatch-audio-folder', () => {
    stopAudioFolderWatch()
    return { watching: false }
  })
}

module.exports = { register, stopAudioFolderWatch }
