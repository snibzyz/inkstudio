'use strict'
/**
 * updateVersion — pure helpers สำหรับ auto-update (ไม่ require electron → unit-test ได้)
 *
 * แยกออกจาก macUpdate.cjs เพื่อเทส logic ที่ตัดสินใจ "มีอัพเดตไหม + โหลดไฟล์ไหน":
 *   - compareSemver : เทียบเวอร์ชัน (latest > current → มีอัพเดต)
 *   - parseFileUrls : ดึงรายการ url จาก section `files:` ของ latest-mac.yml
 *   - pickArchZip   : เลือก .zip ให้ตรง arch ของเครื่อง (กัน mac arm ได้ build x64)
 */

/** เทียบ semver แบบตัวเลขล้วน — คืน 1 ถ้า a>b, -1 ถ้า a<b, 0 ถ้าเท่ากัน
 *  "0.1.10" > "0.1.9" (เทียบเป็นตัวเลข ไม่ใช่ string), ส่วนที่ขาดถือเป็น 0 */
function compareSemver(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

/** ดึง url ทั้งหมดใต้ `files:` ของ latest-mac.yml (หยุดเมื่อเจอ key ระดับบนสุดถัดไป) */
function parseFileUrls(text) {
  const filesIdx = text.search(/^files:\s*$/m)
  if (filesIdx === -1) return []
  const after = text.slice(filesIdx).split('\n').slice(1)
  const urls = []
  for (const line of after) {
    if (/^\S/.test(line)) break
    const m = line.match(/^\s*-\s*url:\s*['"]?([^'"\n]+)['"]?\s*$/)
    if (m) urls.push(m[1].trim())
  }
  return urls
}

/** เลือก .zip ที่ตรง arch (arm64 หรือ x64/x86_64) และไม่ใช่ไฟล์ blockmap */
function pickArchZip(urls, arch) {
  const want = arch === 'arm64' ? /arm64/i : /(x64|x86_64)/i
  return urls.find((u) => /\.zip$/i.test(u) && want.test(u) && !/blockmap/i.test(u)) || null
}

module.exports = { compareSemver, parseFileUrls, pickArchZip }
