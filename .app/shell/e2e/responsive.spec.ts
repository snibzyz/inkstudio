import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

/**
 * Responsive canvas e2e — verifies that the cover artboard always fits inside the
 * pasteboard, stays at the locked 16:9 (1280×720) ratio, and shrinks when the window
 * shrinks. Screenshots at each size are written to e2e/__screenshots__/ for eyeballing.
 *
 * Runs against the built renderer (dist/) in production mode, so `pnpm build` (wired as
 * pretest:e2e) must run first.
 */

const SHELL_DIR = path.resolve(__dirname, '..')
const SHOTS_DIR = path.join(__dirname, '__screenshots__')
const ARTBOARD_RATIO = 1280 / 720 // 16:9

let app: ElectronApplication
let page: Page
let userDataDir: string

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkstudio-e2e-'))

  // The harness may set ELECTRON_RUN_AS_NODE=1, which makes `electron .` boot as plain Node
  // (require('electron') returns a path string, not the API) → main.cjs crashes. Strip it so
  // Electron boots as a real desktop app. Also force production mode (loads dist via file://).
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  delete env.ELECTRON_RUN_AS_NODE
  env.NODE_ENV = 'production'

  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: SHELL_DIR,
    env,
  })
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  // Make sure the cover module is active (it is the default, but be defensive).
  const pasteboard = page.getByTestId('cover-pasteboard')
  if (!(await pasteboard.isVisible().catch(() => false))) {
    await page.getByRole('tab', { name: 'ปก' }).first().click().catch(() => {})
  }
  await pasteboard.waitFor({ state: 'visible', timeout: 20_000 })
})

test.afterAll(async () => {
  await app?.close().catch(() => {})
  try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch { /* ignore */ }
})

async function setWindowSize(width: number, height: number) {
  await app.evaluate(async ({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    win.setBounds({ width: size.width, height: size.height })
  }, { width, height })
  // Let the ResizeObserver + fabric viewport refit settle.
  await page.waitForTimeout(500)
}

async function measure() {
  const pb = await page.getByTestId('cover-pasteboard').boundingBox()
  const ab = await page.getByTestId('cover-artboard').boundingBox()
  if (!pb || !ab) throw new Error('pasteboard/artboard bounding box missing')
  return { pb, ab }
}

const SIZES = [
  { name: '01-xl-1600x1000', w: 1600, h: 1000 },
  { name: '02-lg-1366x900', w: 1366, h: 900 },
  { name: '03-md-1200x820', w: 1200, h: 820 },
  { name: '04-min-1024x680', w: 1024, h: 680 },
]

test('artboard fits the window and keeps 16:9 at every size', async () => {
  for (const size of SIZES) {
    await setWindowSize(size.w, size.h)
    const { pb, ab } = await measure()

    // Fits inside the pasteboard — no overflow (allow 1px rounding).
    expect(ab.width, `artboard width fits pasteboard @ ${size.name}`).toBeLessThanOrEqual(pb.width + 1)
    expect(ab.height, `artboard height fits pasteboard @ ${size.name}`).toBeLessThanOrEqual(pb.height + 1)

    // Stays at the locked 16:9 resolution.
    expect(ab.width / ab.height, `artboard ratio 16:9 @ ${size.name}`).toBeCloseTo(ARTBOARD_RATIO, 1)

    // Actually rendered (not collapsed to zero) — the bug guard for small windows.
    expect(ab.width, `artboard visible @ ${size.name}`).toBeGreaterThan(120)

    await page.screenshot({ path: path.join(SHOTS_DIR, `cover-${size.name}.png`), fullPage: false })
  }
})

test('artboard shrinks when the window shrinks', async () => {
  await setWindowSize(1600, 1000)
  const big = (await measure()).ab

  await setWindowSize(1280, 820)
  const small = (await measure()).ab

  expect(small.width, 'smaller window → narrower artboard').toBeLessThan(big.width)
  expect(small.height, 'smaller window → shorter artboard').toBeLessThan(big.height)
})

test('export dialog stays fully on-screen in the smallest window', async () => {
  await setWindowSize(1024, 680)

  // Open the export modal from the bottom export bar.
  await page.getByRole('button', { name: /ส่งออก/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible', timeout: 10_000 })

  const box = await dialog.boundingBox()
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  if (!box) throw new Error('dialog bounding box missing')

  // Fully inside the viewport — no clipping past any edge (allow 1px rounding).
  expect(box.x, 'dialog left on-screen').toBeGreaterThanOrEqual(-1)
  expect(box.y, 'dialog top on-screen').toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width, 'dialog right on-screen').toBeLessThanOrEqual(vp.w + 1)
  expect(box.y + box.height, 'dialog bottom on-screen').toBeLessThanOrEqual(vp.h + 1)

  await page.screenshot({ path: path.join(SHOTS_DIR, 'modal-export-1024x680.png') })
  await page.keyboard.press('Escape')
})
