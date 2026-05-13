/**
 * autoUpdate — NSIS + electron-updater wiring
 *
 * Flow (Windows NSIS):
 *   1. start(): app บูตเสร็จ — ส่ง autoUpdater.checkForUpdates() ทุก 30 นาที + รอบแรกหลัง 5 วิ
 *   2. มีเวอร์ชันใหม่ → autoUpdater.downloadUpdate() อัตโนมัติ (ดาวน์โหลด .nsis-blockmap diff ถ้ามี)
 *   3. ดาวน์โหลดเสร็จ → emit app:updateDownloaded ให้ UI แสดงปุ่ม "รีสตาร์ทเพื่ออัพเดต"
 *   4. user กดปุ่มในแอป → ipc app:applyUpdate → autoUpdater.quitAndInstall()
 *
 * Events ที่ส่งให้ renderer:
 *   app:updateAvailable    { mode: 'nsis', version, current, releaseDate?, releaseNotes? }
 *   app:updateProgress     { percent, received, total, bytesPerSecond }
 *   app:updateDownloaded   { mode: 'nsis', version }
 *   app:updateError        { message }
 *
 * On macOS: electron-updater รองรับ DMG ผ่าน GitHub provider เหมือนกัน — flow เดียวกัน
 * On dev: ทุกอย่าง no-op
 */

const { ipcMain, app } = require('electron')
const { autoUpdater } = require('electron-updater')
const { createLogger } = require('./helpers/logger.cjs')

const log = createLogger('autoupdate')

let mainWindowRef = null
let periodicTimer = null
const PERIODIC_MS = 30 * 60 * 1000
let _checking = false
let _hasDownloaded = false
let _pending = null

function isSupported() {
  return process.platform === 'win32' || process.platform === 'darwin'
}

function safeSend(channel, payload) {
  try {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) return
    mainWindowRef.webContents.send(channel, payload)
  } catch (err) {
    log.warn('send failed', { channel, error: err && err.message })
  }
}

function wireAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.logger = {
    info: (m) => log.info('eu', { m }),
    warn: (m) => log.warn('eu', { m }),
    error: (m) => log.error('eu', { m }),
    debug: () => {},
  }

  autoUpdater.on('checking-for-update', () => {
    log.info('checking for update')
  })

  autoUpdater.on('update-available', (info) => {
    log.info('update available', { version: info && info.version })
    _pending = info
    safeSend('app:updateAvailable', {
      mode: 'nsis',
      version: info?.version,
      current: app.getVersion(),
      releaseDate: info?.releaseDate ?? null,
      releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : '',
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('no update', { latest: info && info.version, current: app.getVersion() })
  })

  autoUpdater.on('download-progress', (p) => {
    safeSend('app:updateProgress', {
      percent: Math.round(p.percent || 0),
      received: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    _hasDownloaded = true
    log.info('downloaded', { version: info && info.version })
    safeSend('app:updateDownloaded', { mode: 'nsis', version: info?.version })
  })

  autoUpdater.on('error', (err) => {
    log.warn('updater error', { error: (err && err.message) || String(err) })
    safeSend('app:updateError', { message: (err && err.message) || 'update error' })
  })
}

async function checkOnce() {
  if (_checking) {
    log.info('skip — already checking')
    return
  }
  if (process.env.NODE_ENV === 'development') {
    log.info('skip — dev mode')
    return
  }
  if (!isSupported()) {
    log.info('skip — unsupported platform', { platform: process.platform })
    return
  }
  _checking = true
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    log.warn('checkForUpdates failed', { error: err && err.message })
  } finally {
    _checking = false
  }
}

function start(mainWindow) {
  mainWindowRef = mainWindow
  if (process.env.NODE_ENV === 'development') {
    log.info('auto-update disabled in dev')
    return
  }
  if (!isSupported()) {
    log.info('auto-update unsupported', { platform: process.platform })
    return
  }
  wireAutoUpdater()

  setTimeout(() => {
    checkOnce().catch((err) => log.warn('first check failed', { error: err && err.message }))
  }, 5000)
  if (periodicTimer) clearInterval(periodicTimer)
  periodicTimer = setInterval(() => {
    checkOnce().catch((err) => log.warn('periodic check failed', { error: err && err.message }))
  }, PERIODIC_MS)
}

function registerIpc() {
  ipcMain.handle('app:checkUpdate', async () => {
    if (process.env.NODE_ENV === 'development') return { ok: false, error: 'disabled in dev' }
    if (!isSupported()) return { ok: false, error: 'platform not supported' }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, result: result?.updateInfo ?? null }
    } catch (err) {
      return { ok: false, error: err && err.message }
    }
  })

  ipcMain.handle('app:applyUpdate', async () => {
    if (!isSupported()) return { ok: false, error: 'platform not supported' }
    if (!_hasDownloaded) {
      // ถ้ายังไม่ดาวน์โหลด แต่ user กดอัพเดต → trigger download
      if (!_pending) return { ok: false, error: 'no pending update' }
      try {
        await autoUpdater.downloadUpdate()
        return { ok: true, downloaded: false }
      } catch (err) {
        return { ok: false, error: err && err.message }
      }
    }
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        log.error('quitAndInstall failed', { error: err && err.message })
      }
    })
    return { ok: true, downloaded: true }
  })
}

/** electron-updater handles install-on-quit ผ่าน autoInstallOnAppQuit — ไม่มี logic เพิ่มที่ exit */
function applyStagedOnQuit() {
  return false
}

module.exports = { start, registerIpc, applyStagedOnQuit }
