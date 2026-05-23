/**
 * Tests สำหรับ electronIpcShim — แมป window.electron.ipc.* → window.inkstudio.*
 *  - selectFiles routing (single/folder/multi)
 *  - readFileAsDataUrl ประกอบ dataUrl ถูก mime
 *  - exportCoverPng รับได้ทั้ง {dataUrl,outputPath} และ {base64,filePath}
 *  - presets ใช้ localStorage
 *  - startBatchCoverRender ส่ง args ถูกต้องไป render.startBatch
 *  - onRenderProgress / offRenderProgress lifecycle
 *  - listFonts fallback เมื่อ queryLocalFonts ไม่มี
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type InkstudioMock = {
  fs: {
    chooseFile: ReturnType<typeof vi.fn>
    chooseFiles: ReturnType<typeof vi.fn>
    chooseFolder: ReturnType<typeof vi.fn>
    readBytes: ReturnType<typeof vi.fn>
    writeBytes: ReturnType<typeof vi.fn>
  }
  dialog: {
    saveFile: ReturnType<typeof vi.fn>
  }
  render: {
    startBatch: ReturnType<typeof vi.fn>
    cancelJob: ReturnType<typeof vi.fn>
    onProgress: ReturnType<typeof vi.fn>
    listAudioFiles: ReturnType<typeof vi.fn>
    getPreferredEncoder: ReturnType<typeof vi.fn>
    diagnoseEncoder?: ReturnType<typeof vi.fn>
    watchAudioFolder?: ReturnType<typeof vi.fn>
    unwatchAudioFolder?: ReturnType<typeof vi.fn>
    onAudioFolderChanged?: ReturnType<typeof vi.fn>
  }
}

let mock: InkstudioMock
let unsubscribeSpy: ReturnType<typeof vi.fn>

beforeEach(async () => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  unsubscribeSpy = vi.fn()
  mock = {
    fs: {
      chooseFile: vi.fn(),
      chooseFiles: vi.fn(),
      chooseFolder: vi.fn(),
      readBytes: vi.fn(),
      writeBytes: vi.fn(),
    },
    dialog: { saveFile: vi.fn() },
    render: {
      startBatch: vi.fn(),
      cancelJob: vi.fn(),
      onProgress: vi.fn().mockReturnValue(unsubscribeSpy),
      listAudioFiles: vi.fn(),
      getPreferredEncoder: vi.fn(),
      diagnoseEncoder: vi.fn(),
      watchAudioFolder: vi.fn(),
      unwatchAudioFolder: vi.fn(),
      onAudioFolderChanged: vi.fn().mockReturnValue(vi.fn()),
    },
  }
  ;(window as unknown as { inkstudio: InkstudioMock }).inkstudio = mock
  ;(window as unknown as { electron?: unknown }).electron = undefined
  vi.resetModules()
  const { installElectronIpcShim } = await import('../electronIpcShim')
  installElectronIpcShim()
})

afterEach(() => {
  delete (window as unknown as { inkstudio?: InkstudioMock }).inkstudio
  delete (window as unknown as { electron?: unknown }).electron
})

function ipc() {
  return (window as unknown as { electron: { ipc: Record<string, (...args: unknown[]) => unknown> } }).electron.ipc
}

describe('selectFiles routing', () => {
  it('openDirectory → fs.chooseFolder + คืน array', async () => {
    mock.fs.chooseFolder.mockResolvedValue('Z:/folder')
    const res = await (ipc().selectFiles as (a: object) => Promise<string[]>)({
      properties: ['openDirectory'],
    })
    expect(res).toEqual(['Z:/folder'])
    expect(mock.fs.chooseFolder).toHaveBeenCalled()
  })

  it('openDirectory cancel → array ว่าง', async () => {
    mock.fs.chooseFolder.mockResolvedValue(null)
    const res = await (ipc().selectFiles as (a: object) => Promise<string[]>)({ properties: ['openDirectory'] })
    expect(res).toEqual([])
  })

  it('multiSelections → fs.chooseFiles', async () => {
    mock.fs.chooseFiles.mockResolvedValue(['a', 'b'])
    const res = await (ipc().selectFiles as (a: object) => Promise<string[]>)({
      properties: ['openFile', 'multiSelections'],
    })
    expect(res).toEqual(['a', 'b'])
    expect(mock.fs.chooseFiles).toHaveBeenCalled()
  })

  it('openFile (single, default) → fs.chooseFile', async () => {
    mock.fs.chooseFile.mockResolvedValue('Z:/one.png')
    const res = await (ipc().selectFiles as (a: object) => Promise<string[]>)({ properties: ['openFile'] })
    expect(res).toEqual(['Z:/one.png'])
  })

  it('default (ไม่มี properties) → openFile single', async () => {
    mock.fs.chooseFile.mockResolvedValue('Z:/x.png')
    const res = await (ipc().selectFiles as (a: object) => Promise<string[]>)({})
    expect(res).toEqual(['Z:/x.png'])
  })
})

describe('readFileAsDataUrl', () => {
  it('ประกอบ dataUrl + mime ที่ตรง', async () => {
    mock.fs.readBytes.mockResolvedValue({ ok: true, base64: 'ABCD' })
    const url = await (ipc().readFileAsDataUrl as (a: object) => Promise<string>)({ filePath: 'a.png' })
    expect(url).toBe('data:image/png;base64,ABCD')
  })

  it('throws ถ้า readBytes ไม่ ok', async () => {
    mock.fs.readBytes.mockResolvedValue({ ok: false, error: 'enoent' })
    await expect(
      (ipc().readFileAsDataUrl as (a: object) => Promise<string>)({ filePath: 'x.png' })
    ).rejects.toThrow()
  })
})

describe('exportCoverPng', () => {
  it('ใช้ outputPath + dataUrl → strip data prefix แล้ว writeBytes', async () => {
    mock.fs.writeBytes.mockResolvedValue({ ok: true })
    const res = await (ipc().exportCoverPng as (a: object) => Promise<{ ok: boolean }>)({
      outputPath: 'Z:/out.png',
      dataUrl: 'data:image/png;base64,ZGF0YQ==',
    })
    expect(res.ok).toBe(true)
    expect(mock.fs.writeBytes).toHaveBeenCalledWith('Z:/out.png', 'ZGF0YQ==')
  })

  it('ใช้ filePath + base64 ตรง ๆ ก็ได้', async () => {
    mock.fs.writeBytes.mockResolvedValue({ ok: true })
    const res = await (ipc().exportCoverPng as (a: object) => Promise<{ ok: boolean }>)({
      filePath: 'Z:/out.png',
      base64: 'XXX',
    })
    expect(res.ok).toBe(true)
    expect(mock.fs.writeBytes).toHaveBeenCalledWith('Z:/out.png', 'XXX')
  })

  it('ไม่มี outputPath/filePath → คืน error', async () => {
    const res = await (ipc().exportCoverPng as (a: object) => Promise<{ ok: boolean; error?: string }>)({
      dataUrl: 'data:image/png;base64,A',
    })
    expect(res.ok).toBe(false)
  })

  it('ไม่มี base64/dataUrl → คืน error', async () => {
    const res = await (ipc().exportCoverPng as (a: object) => Promise<{ ok: boolean; error?: string }>)({
      outputPath: 'Z:/x.png',
    })
    expect(res.ok).toBe(false)
  })
})

describe('presets localStorage', () => {
  it('listPresets เริ่มต้นเป็น {}', async () => {
    const map = await (ipc().listPresets as () => Promise<Record<string, unknown>>)()
    expect(map).toEqual({})
  })

  it('savePreset → listPresets ได้คืนมา', async () => {
    await (ipc().savePreset as (a: object) => Promise<Record<string, unknown>>)({ name: 'p1', data: { x: 1 } })
    const map = await (ipc().listPresets as () => Promise<Record<string, unknown>>)()
    expect(map).toEqual({ p1: { x: 1 } })
  })

  it('deletePreset ลบรายการ', async () => {
    await (ipc().savePreset as (a: object) => Promise<unknown>)({ name: 'p1', data: { x: 1 } })
    await (ipc().savePreset as (a: object) => Promise<unknown>)({ name: 'p2', data: { y: 2 } })
    const after = await (ipc().deletePreset as (a: object) => Promise<Record<string, unknown>>)({ name: 'p1' })
    expect(after).toEqual({ p2: { y: 2 } })
  })
})

describe('render IPC routing', () => {
  it('startBatchCoverRender ส่ง args ถูกต้องไป render.startBatch', async () => {
    mock.render.startBatch.mockResolvedValue({
      successCount: 1, totalFiles: 1, elapsedSeconds: 1,
      skippedCount: 0, missingCovers: [], encoder: 'sw', resolutionLabel: '144p',
    })
    await (ipc().startBatchCoverRender as (a: object) => Promise<unknown>)({
      jobId: 'j1',
      imagePath: 'Z:/c.png',
      audioFolder: '/a',
      outputFolder: '/o',
      coverFolder: '/cov',
      useMultipleCovers: false,
      titlePrefix: 'EP',
      introClipPath: 'Z:/intro.mp4',
      encodeOption: 'Software (H.264)',
      crfValue: 51,
      resolutionLabel: '144p',
      fps: 1,
      preset: 'ultrafast',
      overwriteMode: 'ask',
      selectedAudioFiles: ['1.mp3'],
    })
    expect(mock.render.startBatch).toHaveBeenCalledTimes(1)
    const arg = mock.render.startBatch.mock.calls[0][0] as Record<string, unknown>
    expect(arg.jobId).toBe('j1')
    expect(arg.coverPath).toBe('Z:/c.png')
    expect(arg.coverFolder).toBeUndefined()
    expect(arg.introClipPath).toBe('Z:/intro.mp4')
    expect(arg.fps).toBe(1)
    expect(arg.preset).toBe('ultrafast')
    expect(arg.overwriteMode).toBe('skip') // 'ask' → 'skip'
  })

  it('useMultipleCovers=true → ใช้ coverFolder + ไม่ส่ง coverPath', async () => {
    mock.render.startBatch.mockResolvedValue({
      successCount: 0, totalFiles: 0, elapsedSeconds: 0,
      skippedCount: 0, missingCovers: [], encoder: '', resolutionLabel: '144p',
    })
    await (ipc().startBatchCoverRender as (a: object) => Promise<unknown>)({
      jobId: 'j2',
      imagePath: '',
      audioFolder: '/a',
      outputFolder: '/o',
      coverFolder: '/covers',
      useMultipleCovers: true,
      titlePrefix: '',
      encodeOption: 'Software (H.264)',
      crfValue: 51,
      resolutionLabel: '144p',
      fps: 1,
      preset: 'ultrafast',
      overwriteMode: 'skip',
      selectedAudioFiles: [],
    })
    const arg = mock.render.startBatch.mock.calls[0][0] as Record<string, unknown>
    expect(arg.coverPath).toBeUndefined()
    expect(arg.coverFolder).toBe('/covers')
  })

  it('cancelRenderJob → render.cancelJob(jobId)', async () => {
    mock.render.cancelJob.mockResolvedValue({ ok: true })
    const res = await (ipc().cancelRenderJob as (a: object) => Promise<{ ok: boolean }>)({ jobId: 'jj' })
    expect(res.ok).toBe(true)
    expect(mock.render.cancelJob).toHaveBeenCalledWith('jj')
  })

  it('listAudioFiles → render.listAudioFiles(folderPath)', async () => {
    mock.render.listAudioFiles.mockResolvedValue(['a.mp3', 'b.mp3'])
    const res = await (ipc().listAudioFiles as (a: object) => Promise<string[]>)({ folderPath: '/x' })
    expect(res).toEqual(['a.mp3', 'b.mp3'])
    expect(mock.render.listAudioFiles).toHaveBeenCalledWith('/x')
  })

  it('getPreferredEncoder → คืน string (รวมเคส error)', async () => {
    mock.render.getPreferredEncoder.mockRejectedValue(new Error('no gpu'))
    const res = await (ipc().getPreferredEncoder as () => Promise<string>)()
    expect(res).toBe('')
  })

  it('onRenderProgress/offRenderProgress lifecycle', async () => {
    const cb = vi.fn()
    ;(ipc().onRenderProgress as (cb: unknown) => void)(cb)
    expect(mock.render.onProgress).toHaveBeenCalledWith(cb)
    ;(ipc().offRenderProgress as () => void)()
    expect(unsubscribeSpy).toHaveBeenCalled()
  })

  it('diagnoseEncoder → proxy render.diagnoseEncoder', async () => {
    mock.render.diagnoseEncoder!.mockResolvedValue({
      preferred: 'NVENC (H.264)',
      gpu: { name: 'RTX 2070', driver: '536.40' },
      nvenc: { ok: true, error: '' },
      encoders: {
        nvencH264: { ok: true, error: '' },
        nvencHevc: { ok: true, error: '' },
        vtH264: { ok: false, error: '' },
        vtHevc: { ok: false, error: '' },
        software: { ok: true, error: '' },
      },
    })
    const res = await (ipc().diagnoseEncoder as (a?: object) => Promise<{ preferred?: string }>)({ refresh: true })
    expect(res.preferred).toBe('NVENC (H.264)')
    expect(mock.render.diagnoseEncoder).toHaveBeenCalledWith(true)
  })

  it('diagnoseEncoder fallback ถ้า render.diagnoseEncoder ไม่มี', async () => {
    delete mock.render.diagnoseEncoder
    const res = await (ipc().diagnoseEncoder as () => Promise<{ preferred?: string }>)()
    expect(res.preferred).toBe('Software (H.264)')
  })

  it('watchAudioFolder → proxy render.watchAudioFolder', async () => {
    mock.render.watchAudioFolder!.mockResolvedValue({ watching: true })
    const res = await (ipc().watchAudioFolder as (a: object) => Promise<{ watching: boolean }>)({ folderPath: '/a' })
    expect(res.watching).toBe(true)
    expect(mock.render.watchAudioFolder).toHaveBeenCalledWith('/a')
  })

  it('unwatchAudioFolder → proxy', async () => {
    mock.render.unwatchAudioFolder!.mockResolvedValue({ watching: false })
    const res = await (ipc().unwatchAudioFolder as () => Promise<{ watching: boolean }>)()
    expect(res.watching).toBe(false)
  })

  it('onAudioFolderChanged/offAudioFolderChanged lifecycle', async () => {
    const audioUnsub = vi.fn()
    mock.render.onAudioFolderChanged!.mockReturnValue(audioUnsub)
    const cb = vi.fn()
    ;(ipc().onAudioFolderChanged as (cb: unknown) => void)(cb)
    expect(mock.render.onAudioFolderChanged).toHaveBeenCalledWith(cb)
    ;(ipc().offAudioFolderChanged as () => void)()
    expect(audioUnsub).toHaveBeenCalled()
  })
})

describe('listFonts fallback', () => {
  it('คืน array ว่างเมื่อ queryLocalFonts ไม่มี', async () => {
    const nav = navigator as unknown as Record<string, unknown>
    expect(typeof nav.queryLocalFonts === 'function' || nav.queryLocalFonts === undefined).toBe(true)
    const fonts = await (ipc().listFonts as () => Promise<string[]>)()
    expect(Array.isArray(fonts)).toBe(true)
  })
})

describe('shim เมื่อไม่มี window.inkstudio', () => {
  it('reject ทุก call', async () => {
    delete (window as unknown as { inkstudio?: InkstudioMock }).inkstudio
    delete (window as unknown as { electron?: unknown }).electron
    vi.resetModules()
    const { installElectronIpcShim } = await import('../electronIpcShim')
    installElectronIpcShim()
    await expect(
      (ipc().selectFiles as (a: object) => Promise<unknown>)({ properties: ['openFile'] })
    ).rejects.toThrow()
  })
})
