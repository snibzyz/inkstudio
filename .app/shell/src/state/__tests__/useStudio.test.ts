import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(async () => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  const { useStudio } = await import('../useStudio')
  useStudio.setState({ coverOutput: null })
})

describe('useStudio — cover→render sync', () => {
  it('ค่า initial เป็น null', async () => {
    const { useStudio } = await import('../useStudio')
    expect(useStudio.getState().coverOutput).toBeNull()
  })

  it('setCoverOutput เก็บ folder + timestamp', async () => {
    const { useStudio } = await import('../useStudio')
    const t0 = Date.now()
    useStudio.getState().setCoverOutput({
      kind: 'folder',
      folderPath: 'Z:/output/covers',
      updatedAt: t0,
    })
    expect(useStudio.getState().coverOutput).toEqual({
      kind: 'folder',
      folderPath: 'Z:/output/covers',
      updatedAt: t0,
    })
  })

  it('setCoverOutput persist ลง localStorage', async () => {
    const { useStudio } = await import('../useStudio')
    useStudio.getState().setCoverOutput({
      kind: 'single',
      filePath: 'Z:/foo.png',
      updatedAt: 1234567890,
    })
    const raw = localStorage.getItem('inkstudio:studio:v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.coverOutput).toEqual({
      kind: 'single',
      filePath: 'Z:/foo.png',
      updatedAt: 1234567890,
    })
  })

  it('clearCoverOutput รีเซ็ตเป็น null + clear localStorage entry', async () => {
    const { useStudio } = await import('../useStudio')
    useStudio.getState().setCoverOutput({
      kind: 'folder',
      folderPath: 'Z:/x',
      updatedAt: 1,
    })
    useStudio.getState().clearCoverOutput()
    expect(useStudio.getState().coverOutput).toBeNull()
    const raw = localStorage.getItem('inkstudio:studio:v1')
    const parsed = JSON.parse(raw ?? '{}')
    expect(parsed.coverOutput).toBeNull()
  })
})
