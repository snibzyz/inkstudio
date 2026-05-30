/**
 * autoUpdate — NSIS + electron-updater wiring
 *
 * Flow (Windows NSIS — silent):
 *   1. start(): app บูตเสร็จ — ส่ง autoUpdater.checkForUpdates() ทุก 30 นาที + รอบแรกหลัง 5 วิ
 *   2. มีเวอร์ชันใหม่ → autoUpdater.downloadUpdate() อัตโนมัติ (ดาวน์โหลด .nsis-blockmap diff ถ้ามี)
 *   3. ดาวน์โหลดเสร็จ → emit app:updateDownloaded ให้ UI แสดงปุ่ม "รีสตาร์ทเพื่ออัพเดต"
 *   4. user กดปุ่ม → ipc app:applyUpdate → autoUpdater.quitAndInstall(true, true)
 *      = ติดตั้ง "เงียบ" (/S, ไม่เด้ง wizard) แล้วเปิดแอปใหม่ให้อัตโนมัติ
 *   หรือ: ปิดแอปเฉย ๆ → autoInstallOnAppQuit=true ติดตั้ง update ที่ดาวน์โหลดไว้แบบเงียบตอน quit
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
const macUpdater = require('./macUpdate.cjs')

const log = createLogger('autoupdate')

let mainWindowRef = null
let periodicTimer = null
const PERIODIC_MS = 30 * 60 * 1000
let _checking = false
let _hasDownloaded = false
let _pending = null
let _pendingMacUpdate = null

function isSupported() {
  return process.platform === 'win32' || process.platform === 'darwin'
}

// Ad-hoc signed mac builds can't use Squirrel.Mac auto-update — Squirrel
// requires Apple Developer ID signature for verification. Route mac through
// our custom updater (download zip + swap .app + re-apply ad-hoc codesign).
function useMacCustomUpdater() {
  return macUpdater.isMacPackaged()
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

async function checkMacOnce() {
  const result = await macUpdater.checkForUpdates()
  if (!result || !result.available) {
    log.info('no mac update')
    return
  }
  _pendingMacUpdate = result
  log.info('mac update available', { version: result.latest })
  safeSend('app:updateAvailable', {
    mode: 'portable',
    version: result.latest,
    current: result.current,
    downloadUrl: result.downloadUrl,
    releaseUrl: result.releaseUrl,
    releaseDate: result.releaseDate,
  })
}

function start(mainWindow) {
  mainWindowRef = mainWindow
  if (process.env.NODE_ENV === 'development') {
    log.info('auto-update disabled in dev')
    return
  }
  if (useMacCustomUpdater()) {
    log.info('mac mode — using custom updater (ad-hoc signed builds)')
    setTimeout(() => {
      checkMacOnce().catch((err) => log.warn('first mac check failed', { error: err && err.message }))
    }, 5000)
    if (periodicTimer) clearInterval(periodicTimer)
    periodicTimer = setInterval(() => {
      checkMacOnce().catch((err) => log.warn('periodic mac check failed', { error: err && err.message }))
    }, PERIODIC_MS)
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
    if (useMacCustomUpdater()) {
      const result = await macUpdater.checkForUpdates()
      if (result && result.available) _pendingMacUpdate = result
      return { ok: true, result }
    }
    if (!isSupported()) return { ok: false, error: 'platform not supported' }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, result: result?.updateInfo ?? null }
    } catch (err) {
      return { ok: false, error: err && err.message }
    }
  })

  ipcMain.handle('app:applyUpdate', async () => {
    if (useMacCustomUpdater()) {
      if (!_pendingMacUpdate) return { ok: false, error: 'no pending update' }
      try {
        await macUpdater.downloadAndApply(_pendingMacUpdate.downloadUrl, _pendingMacUpdate.latest, mainWindowRef)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err && err.message }
      }
    }
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
        // isSilent=true → รัน NSIS installer ด้วย /S (เงียบ ไม่เด้ง wizard ให้คลิก Next/Install)
        //   จำเป็นสำหรับ assisted installer (oneClick:false) — ถ้า false จะเด้ง UI
        // isForceRunAfter=true → เปิดแอปเวอร์ชันใหม่ให้อัตโนมัติหลังติดตั้งเสร็จ
        autoUpdater.quitAndInstall(true, true)
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
