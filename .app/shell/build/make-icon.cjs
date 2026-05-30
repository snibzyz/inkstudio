/**
 * make-icon.cjs — generate a multi-resolution Windows .ico (+ mac/window .png)
 * from a single square source PNG, using @napi-rs/canvas (already a devDep).
 *
 * Usage:
 *   node build/make-icon.cjs <source.png> <out.ico> <out.png>
 *
 * The .ico embeds PNG-compressed entries at 16/24/32/48/64/128/256 px
 * (the modern Vista+ ICO format that Windows 7+ and electron-builder accept).
 */
const fs = require('fs')
const { createCanvas, loadImage } = require('@napi-rs/canvas')

const SRC = process.argv[2]
const OUT_ICO = process.argv[3]
const OUT_PNG = process.argv[4]
const SIZES = [16, 24, 32, 48, 64, 128, 256]

function resizePng(img, size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)
  return canvas.toBuffer('image/png')
}

async function main() {
  if (!SRC || !OUT_ICO || !OUT_PNG) {
    console.error('usage: node build/make-icon.cjs <source.png> <out.ico> <out.png>')
    process.exit(2)
  }
  const img = await loadImage(SRC)

  // --- build .ico (ICONDIR + entries + PNG blobs) ---
  const pngs = SIZES.map((size) => ({ size, buf: resizePng(img, size) }))
  const count = pngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = icon
  header.writeUInt16LE(count, 4)

  const entries = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  pngs.forEach((p, i) => {
    const e = i * 16
    entries.writeUInt8(p.size >= 256 ? 0 : p.size, e + 0) // width (0 => 256)
    entries.writeUInt8(p.size >= 256 ? 0 : p.size, e + 1) // height (0 => 256)
    entries.writeUInt8(0, e + 2) // color count
    entries.writeUInt8(0, e + 3) // reserved
    entries.writeUInt16LE(1, e + 4) // planes
    entries.writeUInt16LE(32, e + 6) // bit count
    entries.writeUInt32LE(p.buf.length, e + 8) // bytes in resource
    entries.writeUInt32LE(offset, e + 12) // image offset
    offset += p.buf.length
  })
  const ico = Buffer.concat([header, entries, ...pngs.map((p) => p.buf)])
  fs.writeFileSync(OUT_ICO, ico)

  // --- mac/window .png: a clean 512px square (electron-builder mac needs >=512) ---
  fs.writeFileSync(OUT_PNG, resizePng(img, 512))

  console.log(`ico -> ${OUT_ICO} (${SIZES.join(',')} px, ${ico.length} bytes)`)
  console.log(`png -> ${OUT_PNG} (512 px)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
