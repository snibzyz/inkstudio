import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(async () => {
  // เคลียร์ localStorage + reset module cache เพื่อให้ store เริ่มจาก default
  if (typeof localStorage !== 'undefined') localStorage.clear()
  const mod = await import('../useCoverState')
  // เรียก vitest reset เพื่อให้ store ใหม่ทุก test
  mod.useCoverState.setState({
    baseImage: null,
    background: { blur: 16, dim: 0.45 },
    foreground: {
      show: true,
      scale: 0.78,
      xPercent: 28,
      yPercent: 50,
      cornerRadius: 8,
      shadow: true,
    },
    title: {
      text: 'ชื่อเรื่อง',
      fontSize: 48,
      color: '#ffffff',
      xPercent: 60,
      yPercent: 38,
      align: 'left',
      stroke: true,
      weight: 700,
    },
    chapter: {
      text: 'ตอนที่ {n}',
      fontSize: 64,
      color: '#F59E0B',
      xPercent: 60,
      yPercent: 60,
      align: 'left',
      stroke: true,
      weight: 800,
    },
    batch: {
      start: 1,
      end: 10,
      step: 1,
      padding: 3,
      outputFolder: '',
      format: 'png',
      quality: 92,
    },
    previewChapter: 1,
    scripts: {},
    selectedScript: '',
    job: { busy: false, progress: 0, current: 0, total: 0, message: '', error: null },
  })
})

describe('useCoverState — patchers', () => {
  it('patchBackground แก้แค่ field ที่ส่งมา', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().patchBackground({ blur: 30 })
    expect(useCoverState.getState().background).toMatchObject({ blur: 30, dim: 0.45 })
  })

  it('patchTitle อัพเดต title โดยไม่กระทบ chapter', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().patchTitle({ text: 'หนังสือใหม่' })
    expect(useCoverState.getState().title.text).toBe('หนังสือใหม่')
    expect(useCoverState.getState().chapter.text).toBe('ตอนที่ {n}')
  })

  it('patchChapter ไม่กระทบ title', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().patchChapter({ text: 'EP {n}', fontSize: 72 })
    expect(useCoverState.getState().chapter.text).toBe('EP {n}')
    expect(useCoverState.getState().chapter.fontSize).toBe(72)
    expect(useCoverState.getState().title.text).toBe('ชื่อเรื่อง')
  })

  it('patchBatch รักษาค่าเดิมของ field ที่ไม่ได้ส่ง', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().patchBatch({ start: 5, end: 25 })
    expect(useCoverState.getState().batch).toMatchObject({
      start: 5,
      end: 25,
      step: 1,
      padding: 3,
      format: 'png',
    })
  })

  it('setPreviewChapter clamp negative ↦ 0', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().setPreviewChapter(-10)
    expect(useCoverState.getState().previewChapter).toBe(0)
  })

  it('setPreviewChapter floor float', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().setPreviewChapter(7.8)
    expect(useCoverState.getState().previewChapter).toBe(7)
  })
})

describe('useCoverState — scripts', () => {
  it('saveScript เก็บ snapshot ของ config ปัจจุบัน', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().patchTitle({ text: 'นิยายเรื่อง A' })
    useCoverState.getState().patchChapter({ text: 'ตอนที่ {n} · เรื่อง A' })
    useCoverState.getState().patchBatch({ start: 1, end: 50 })
    useCoverState.getState().saveScript('นิยาย A')

    const { scripts, selectedScript } = useCoverState.getState()
    expect(selectedScript).toBe('นิยาย A')
    expect(scripts['นิยาย A']).toBeDefined()
    expect(scripts['นิยาย A'].title.text).toBe('นิยายเรื่อง A')
    expect(scripts['นิยาย A'].chapter.text).toBe('ตอนที่ {n} · เรื่อง A')
    expect(scripts['นิยาย A'].batch.end).toBe(50)
  })

  it('saveScript ตัดช่องว่าง + skip ถ้าว่าง', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().saveScript('   ')
    expect(Object.keys(useCoverState.getState().scripts)).toHaveLength(0)

    useCoverState.getState().saveScript('  ok  ')
    expect(useCoverState.getState().scripts.ok).toBeDefined()
  })

  it('loadScript กลับเอาค่าจาก snapshot มาใช้', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().patchTitle({ text: 'A' })
    useCoverState.getState().saveScript('preset-A')
    useCoverState.getState().patchTitle({ text: 'B' })
    expect(useCoverState.getState().title.text).toBe('B')

    useCoverState.getState().loadScript('preset-A')
    expect(useCoverState.getState().title.text).toBe('A')
    expect(useCoverState.getState().selectedScript).toBe('preset-A')
  })

  it('deleteScript เอาออก + clear selection ถ้าเลือกอยู่', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().saveScript('keep')
    useCoverState.getState().saveScript('drop')
    useCoverState.getState().setSelectedScript('drop')
    expect(Object.keys(useCoverState.getState().scripts).sort()).toEqual(['drop', 'keep'])

    useCoverState.getState().deleteScript('drop')
    expect(Object.keys(useCoverState.getState().scripts)).toEqual(['keep'])
    expect(useCoverState.getState().selectedScript).toBe('')
  })

  it('deleteScript ไม่ clear selection ถ้าเลือกตัวอื่น', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().saveScript('keep')
    useCoverState.getState().saveScript('drop')
    useCoverState.getState().setSelectedScript('keep')

    useCoverState.getState().deleteScript('drop')
    expect(useCoverState.getState().selectedScript).toBe('keep')
  })
})

describe('useCoverState — job', () => {
  it('setJob merge state แทนที่จะแทนที่', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().setJob({ busy: true, message: 'start' })
    useCoverState.getState().setJob({ progress: 0.5 })

    expect(useCoverState.getState().job).toMatchObject({
      busy: true,
      message: 'start',
      progress: 0.5,
    })
  })

  it('resetJob ตั้ง state กลับ default', async () => {
    const { useCoverState } = await import('../useCoverState')
    useCoverState.getState().setJob({ busy: true, progress: 0.5, error: 'oops' })
    useCoverState.getState().resetJob()
    expect(useCoverState.getState().job).toEqual({
      busy: false,
      progress: 0,
      current: 0,
      total: 0,
      message: '',
      error: null,
    })
  })
})
