/**
 * Tests สำหรับ useHubWorkspace shim
 * — mock window.inkstudio.fs/shell + ตรวจ readWorkspaceFileAsDataUrl / openFolder / explorer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type InkStudioMock = {
  fs: {
    readBytes: ReturnType<typeof vi.fn>
    chooseFolder: ReturnType<typeof vi.fn>
    revealFolder: ReturnType<typeof vi.fn>
  }
  shell: {
    showItemInFolder: ReturnType<typeof vi.fn>
  }
}

let mockInk: InkStudioMock

beforeEach(async () => {
  mockInk = {
    fs: {
      readBytes: vi.fn(),
      chooseFolder: vi.fn(),
      revealFolder: vi.fn(),
    },
    shell: {
      showItemInFolder: vi.fn(),
    },
  }
  ;(window as unknown as { inkstudio: InkStudioMock }).inkstudio = mockInk
  vi.resetModules()
})

afterEach(() => {
  delete (window as unknown as { inkstudio?: InkStudioMock }).inkstudio
})

describe('useHubWorkspace — initial shape', () => {
  it('ค่า default ของ workspace state เป็น null/empty', async () => {
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const s = useHubWorkspace.getState()
    expect(s.workspaceRoot).toBeNull()
    expect(s.activeProject).toBeNull()
    expect(s.workspaceOpenFilePath).toBeNull()
    expect(s.activeProjectId).toBe('inkstudio')
    expect(s.hubWorkspaceActiveMode).toBe('cover')
  })

  it('getActiveProjectRelRoot คืน null', async () => {
    const { useHubWorkspace } = await import('../useHubWorkspace')
    expect(useHubWorkspace.getState().getActiveProjectRelRoot()).toBeNull()
  })
})

describe('readWorkspaceFileAsDataUrl', () => {
  it('คืน dataUrl ถ้า fs.readBytes ok', async () => {
    mockInk.fs.readBytes.mockResolvedValue({ ok: true, base64: 'AAAA' })
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const res = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('Z:/x.png')
    expect(res.missing).toBe(false)
    expect(res.dataUrl).toBe('data:image/png;base64,AAAA')
    expect(mockInk.fs.readBytes).toHaveBeenCalledWith('Z:/x.png')
  })

  it('คืน missing=true ถ้า fs.readBytes ไม่ ok', async () => {
    mockInk.fs.readBytes.mockResolvedValue({ ok: false, error: 'enoent' })
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const res = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('Z:/missing.png')
    expect(res.missing).toBe(true)
    expect(res.dataUrl).toBeNull()
  })

  it('คืน missing=true ถ้า fs.readBytes throw', async () => {
    mockInk.fs.readBytes.mockRejectedValue(new Error('io'))
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const res = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('Z:/x.png')
    expect(res.missing).toBe(true)
  })

  it('mime detection ตามนามสกุล', async () => {
    mockInk.fs.readBytes.mockResolvedValue({ ok: true, base64: 'AA' })
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const png = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('a.png')
    const jpg = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('a.jpg')
    const webp = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('a.webp')
    expect(png.dataUrl).toContain('image/png')
    expect(jpg.dataUrl).toContain('image/jpeg')
    expect(webp.dataUrl).toContain('image/webp')
  })

  it('คืน missing เมื่อไม่มี window.inkstudio', async () => {
    delete (window as unknown as { inkstudio?: InkStudioMock }).inkstudio
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const res = await useHubWorkspace.getState().readWorkspaceFileAsDataUrl('x')
    expect(res.missing).toBe(true)
  })
})

describe('openFolder', () => {
  it('ใส่ path → reveal โฟลเดอร์ + คืน path', async () => {
    mockInk.fs.revealFolder.mockResolvedValue(undefined)
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const result = await useHubWorkspace.getState().openFolder('Z:/out')
    expect(result).toBe('Z:/out')
    expect(mockInk.fs.revealFolder).toHaveBeenCalledWith('Z:/out')
  })

  it('ไม่ใส่ path → เปิด picker', async () => {
    mockInk.fs.chooseFolder.mockResolvedValue('Z:/picked')
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const result = await useHubWorkspace.getState().openFolder()
    expect(result).toBe('Z:/picked')
    expect(mockInk.fs.chooseFolder).toHaveBeenCalled()
  })

  it('picker cancel → คืน null', async () => {
    mockInk.fs.chooseFolder.mockResolvedValue(null)
    const { useHubWorkspace } = await import('../useHubWorkspace')
    const result = await useHubWorkspace.getState().openFolder()
    expect(result).toBeNull()
  })
})

describe('requestExplorerReveal', () => {
  it('เรียก shell.showItemInFolder', async () => {
    mockInk.shell.showItemInFolder.mockResolvedValue(undefined)
    const { useHubWorkspace } = await import('../useHubWorkspace')
    useHubWorkspace.getState().requestExplorerReveal('Z:/x.png')
    expect(mockInk.shell.showItemInFolder).toHaveBeenCalledWith('Z:/x.png')
  })
})

describe('no-op setters (workspace-tab ไม่ใช้)', () => {
  it('setEditorTabCloseForMode/CycleForMode ไม่ throw', async () => {
    const { useHubWorkspace } = await import('../useHubWorkspace')
    expect(() => useHubWorkspace.getState().setEditorTabCloseForMode('cover', () => true)).not.toThrow()
    expect(() => useHubWorkspace.getState().setEditorTabCycleForMode('cover', () => true)).not.toThrow()
  })

  it('hydrate resolves', async () => {
    const { useHubWorkspace } = await import('../useHubWorkspace')
    await expect(useHubWorkspace.getState().hydrate()).resolves.toBeUndefined()
  })

  it('requestWorkspaceFileOpen ไม่ throw', async () => {
    const { useHubWorkspace } = await import('../useHubWorkspace')
    expect(() => useHubWorkspace.getState().requestWorkspaceFileOpen('foo')).not.toThrow()
    expect(() => useHubWorkspace.getState().requestWorkspaceFileOpen(null)).not.toThrow()
  })
})
