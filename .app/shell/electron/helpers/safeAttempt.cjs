'use strict'
/**
 * safeAttempt — wrapper สำหรับ "best-effort" operations ใน IPC handlers
 *
 * แทนการเขียน `try { x() } catch { /* ignore *\/ }` กระจัดกระจาย
 * เพื่อให้ debug ได้ตอน INKIDEA_DEBUG=1 (เห็น label + reason) แต่ตอน prod ยัง silent เหมือนเดิม
 *
 * ใช้กับเคส cleanup: unlink temp files, kill child processes, removeHandler ที่ไม่เคยลงทะเบียน
 *
 * Examples:
 *   safeAttempt('unlink temp', () => fsp.unlink(tempPath))
 *   safeAttempt('kill ffmpeg', () => child.kill('SIGKILL'))
 *   await safeAttemptAsync('cleanup job dir', () => fsp.rm(jobDir, { recursive: true, force: true }))
 */

const { createLogger } = require('./logger.cjs')
const log = createLogger('safe-attempt')

function safeAttempt(label, fn) {
  try {
    return fn()
  } catch (e) {
    log.debug(`silent: ${label}`, { error: String(e && e.message ? e.message : e) })
    return undefined
  }
}

async function safeAttemptAsync(label, fn) {
  try {
    return await fn()
  } catch (e) {
    log.debug(`silent: ${label}`, { error: String(e && e.message ? e.message : e) })
    return undefined
  }
}

module.exports = { safeAttempt, safeAttemptAsync }
