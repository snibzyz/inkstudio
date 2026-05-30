import { defineConfig } from '@playwright/test'

/**
 * Electron e2e config.
 *
 * The app holds a single-instance lock (electron/main.cjs → requestSingleInstanceLock),
 * so we MUST run serially — never parallelize Electron launches.
 *
 * Tests launch the *built* renderer (dist/) in production mode (file:// load), so they
 * don't need the Vite dev server running. `pretest:e2e` builds dist first.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './e2e/.artifacts',
})
