import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(async () => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  const { useRender } = await import('../useRender')
  useRender.setState({
    coverPath: '',
    coverFolder: '',
    useMultipleCovers: false,
    audioFolder: '',
    outputFolder: '',
    titlePrefix: '',
    encodeOption: 'Software (H.264)',
    crfValue: 26,
    resolutionLabel: '720p',
    selectedMachinePreset: null,
    audioFiles: [],
    audioSearch: '',
    selectedAudioFiles: new Set(),
    presets: {},
    selectedPresetName: '',
    presetNameInput: '',
    job: {
      busy: false,
      jobId: null,
      progress: 0,
      current: 0,
      total: 0,
      message: '',
      error: null,
      fileName: '',
      currentTimeText: '',
      durationText: '',
      logs: [],
      summary: null,
    },
    ffmpeg: { ok: false, version: '', path: '', checked: false },
  })
})

describe('useRender — encoding setters', () => {
  it('setEncodeOption clear machine match ถ้าค่าใหม่ไม่ตรง preset', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().applyMachinePreset('weak')
    expect(useRender.getState().selectedMachinePreset).toBe('weak')
    useRender.getState().setEncodeOption('NVENC (H.265)')
    expect(useRender.getState().selectedMachinePreset).toBeNull()
  })

  it('applyMachinePreset เซ็ตทั้ง 3 ค่า + flag machine preset', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().applyMachinePreset('strong')
    const s = useRender.getState()
    expect(s.encodeOption).toBe('NVENC (H.264)')
    expect(s.crfValue).toBe(22)
    expect(s.resolutionLabel).toBe('1080p')
    expect(s.selectedMachinePreset).toBe('strong')
  })

  it('setCrfValue ตรวจ match กับ machine preset อัตโนมัติ', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setEncodeOption('Software (H.264)')
    useRender.getState().setResolutionLabel('720p')
    useRender.getState().setCrfValue(26)
    expect(useRender.getState().selectedMachinePreset).toBe('medium')
  })
})

describe('useRender — audio files selection', () => {
  it('setAudioFiles รักษา selection ที่ยังอยู่ใน list ใหม่', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setAudioFiles(['a.mp3', 'b.mp3', 'c.mp3'])
    useRender.getState().clearAudioSelection()
    useRender.getState().toggleAudioFile('b.mp3')
    expect(useRender.getState().selectedAudioFiles.has('b.mp3')).toBe(true)

    useRender.getState().setAudioFiles(['b.mp3', 'd.mp3'])
    expect(useRender.getState().selectedAudioFiles.has('b.mp3')).toBe(true)
    expect(useRender.getState().selectedAudioFiles.has('d.mp3')).toBe(false)
  })

  it('setAudioFiles เซ็ต all-selected ถ้า selection ก่อนหน้าว่าง', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setAudioFiles(['x.mp3', 'y.mp3'])
    expect(useRender.getState().selectedAudioFiles.size).toBe(2)
  })

  it('toggleAudioFile + selectAll + clear ทำงานถูก', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setAudioFiles(['1.mp3', '2.mp3', '3.mp3'])
    useRender.getState().clearAudioSelection()
    expect(useRender.getState().selectedAudioFiles.size).toBe(0)
    useRender.getState().toggleAudioFile('2.mp3')
    expect(useRender.getState().selectedAudioFiles.has('2.mp3')).toBe(true)
    useRender.getState().toggleAudioFile('2.mp3')
    expect(useRender.getState().selectedAudioFiles.has('2.mp3')).toBe(false)
    useRender.getState().selectAllAudio()
    expect(useRender.getState().selectedAudioFiles.size).toBe(3)
  })
})

describe('useRender — presets', () => {
  it('savePreset + loadPreset round-trip ค่า', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setCoverPath('Z:/cover.png')
    useRender.getState().setAudioFolder('Z:/audio')
    useRender.getState().setOutputFolder('Z:/out')
    useRender.getState().applyMachinePreset('weak')
    useRender.getState().savePreset('นิยาย-A')

    // เปลี่ยนทุกอย่าง
    useRender.getState().setCoverPath('')
    useRender.getState().setOutputFolder('')
    useRender.getState().applyMachinePreset('strong')

    useRender.getState().loadPreset('นิยาย-A')
    const s = useRender.getState()
    expect(s.coverPath).toBe('Z:/cover.png')
    expect(s.audioFolder).toBe('Z:/audio')
    expect(s.outputFolder).toBe('Z:/out')
    expect(s.encodeOption).toBe('Software (H.264)')
    expect(s.crfValue).toBe(30)
    expect(s.resolutionLabel).toBe('480p')
    expect(s.selectedMachinePreset).toBe('weak')
  })

  it('deletePreset ลบออก + clear selected ถ้าเลือกอยู่', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().savePreset('a')
    useRender.getState().savePreset('b')
    useRender.getState().setSelectedPresetName('b')

    useRender.getState().deletePreset('b')
    expect(Object.keys(useRender.getState().presets)).toEqual(['a'])
    expect(useRender.getState().selectedPresetName).toBe('')
  })
})

describe('useRender — job + logs', () => {
  it('appendLog skip ซ้ำติดกัน', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().appendLog('first')
    useRender.getState().appendLog('first')
    useRender.getState().appendLog('second')
    expect(useRender.getState().job.logs).toEqual(['first', 'second'])
  })

  it('appendLog cap ที่ 200 บรรทัด', async () => {
    const { useRender } = await import('../useRender')
    for (let i = 0; i < 250; i += 1) useRender.getState().appendLog(`line-${i}`)
    expect(useRender.getState().job.logs.length).toBe(200)
    expect(useRender.getState().job.logs[0]).toBe('line-50')
    expect(useRender.getState().job.logs[199]).toBe('line-249')
  })

  it('setFfmpeg เซ็ต flag checked=true เสมอ', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setFfmpeg({ ok: true, version: '6.1.1', path: 'C:/ffmpeg.exe' })
    expect(useRender.getState().ffmpeg).toEqual({
      ok: true,
      version: '6.1.1',
      path: 'C:/ffmpeg.exe',
      checked: true,
    })
  })
})
