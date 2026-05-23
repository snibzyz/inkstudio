/**
 * Tests สำหรับ useRender store (INKIDEA-shaped)
 * — ตรวจ initial state + setters + actions
 * — ตรวจ persist encoding + intro + presets ลง localStorage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CRF,
  DEFAULT_ENCODE_OPTION,
  DEFAULT_RESOLUTION,
  LOG_BUFFER_LIMIT,
  STORAGE_KEY,
} from '../renderConstants'

beforeEach(async () => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  vi.resetModules()
})

describe('useRender — initial state', () => {
  it('source ฟิลด์เริ่มต้นเป็น empty string', async () => {
    const { useRender } = await import('../useRender')
    const s = useRender.getState()
    expect(s.imagePath).toBe('')
    expect(s.audioFolder).toBe('')
    expect(s.outputFolder).toBe('')
    expect(s.coverFolder).toBe('')
    expect(s.useMultipleCovers).toBe(false)
    expect(s.titlePrefix).toBe('')
    expect(s.introPath).toBe('')
    expect(s.useIntro).toBe(false)
  })

  it('encoding default ตาม renderConstants', async () => {
    const { useRender } = await import('../useRender')
    const s = useRender.getState()
    expect(s.encodeOption).toBe(DEFAULT_ENCODE_OPTION)
    expect(s.crfValue).toBe(DEFAULT_CRF)
    expect(s.resolution).toBe(DEFAULT_RESOLUTION)
    expect(s.encoderUserSet).toBe(false)
  })

  it('job state เริ่มเป็น idle', async () => {
    const { useRender } = await import('../useRender')
    const s = useRender.getState()
    expect(s.busy).toBe(false)
    expect(s.error).toBeNull()
    expect(s.status).toBe('พร้อมทำงาน')
    expect(s.progress).toBe(0)
    expect(s.logs).toEqual([])
  })

  it('selectedAudioFiles เริ่มเป็น empty Set', async () => {
    const { useRender } = await import('../useRender')
    expect(useRender.getState().selectedAudioFiles.size).toBe(0)
  })
})

describe('useRender — source setters', () => {
  it('setImagePath เซ็ตค่า', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setImagePath('Z:/cover.png')
    expect(useRender.getState().imagePath).toBe('Z:/cover.png')
  })

  it('setUseMultipleCovers toggle', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setUseMultipleCovers(true)
    expect(useRender.getState().useMultipleCovers).toBe(true)
  })

  it('setIntroPath + setUseIntro persist localStorage', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setIntroPath('Z:/intro.mp4')
    useRender.getState().setUseIntro(true)
    expect(useRender.getState().introPath).toBe('Z:/intro.mp4')
    expect(useRender.getState().useIntro).toBe(true)
    // persist เป็น debounce 120ms — รอแล้วเช็ค
    await new Promise((r) => setTimeout(r, 200))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.introPath).toBe('Z:/intro.mp4')
    expect(parsed.useIntro).toBe(true)
  })

  it('load persisted introPath ตอน boot', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ introPath: 'Z:/saved.mp4', useIntro: true }))
    const { useRender } = await import('../useRender')
    expect(useRender.getState().introPath).toBe('Z:/saved.mp4')
    expect(useRender.getState().useIntro).toBe(true)
  })
})

describe('useRender — encoding setters', () => {
  it('setEncodeOption (manual) flips encoderUserSet=true', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setEncodeOption('NVENC (H.264)')
    expect(useRender.getState().encodeOption).toBe('NVENC (H.264)')
    expect(useRender.getState().encoderUserSet).toBe(true)
  })

  it('setEncodeOption (auto) does NOT flip encoderUserSet', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setEncodeOption('NVENC (H.264)', { auto: true })
    expect(useRender.getState().encodeOption).toBe('NVENC (H.264)')
    expect(useRender.getState().encoderUserSet).toBe(false)
  })

  it('applyDetectedEncoder respects user choice', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setEncodeOption('Software (H.264)') // user pick
    useRender.getState().applyDetectedEncoder('NVENC (H.264)')
    expect(useRender.getState().encodeOption).toBe('Software (H.264)')
  })

  it('applyDetectedEncoder applies when user has NOT chosen', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().applyDetectedEncoder('NVENC (H.264)')
    expect(useRender.getState().encodeOption).toBe('NVENC (H.264)')
  })
})

describe('useRender — files selection', () => {
  it('selectAll เลือกทุกไฟล์', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setAudioFiles(['a.mp3', 'b.mp3', 'c.mp3'])
    useRender.getState().selectAll()
    const sel = useRender.getState().selectedAudioFiles
    expect(sel.size).toBe(3)
    expect(sel.has('a.mp3')).toBe(true)
    expect(sel.has('c.mp3')).toBe(true)
  })

  it('clearSelection ล้างทั้งหมด', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().setAudioFiles(['a.mp3'])
    useRender.getState().selectAll()
    useRender.getState().clearSelection()
    expect(useRender.getState().selectedAudioFiles.size).toBe(0)
  })

  it('toggleAudioFile เพิ่ม/ลบ', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().toggleAudioFile('a.mp3')
    expect(useRender.getState().selectedAudioFiles.has('a.mp3')).toBe(true)
    useRender.getState().toggleAudioFile('a.mp3')
    expect(useRender.getState().selectedAudioFiles.has('a.mp3')).toBe(false)
  })
})

describe('useRender — presets', () => {
  it('applyPreset เซ็ตทุกฟิลด์ + flip encoderUserSet=true', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().applyPreset({
      image_path: 'Z:/cover.png',
      audio_folder: '/a',
      output_folder: '/o',
      cover_folder: '/c',
      use_multiple_covers: true,
      title_prefix: 'EP',
      encode_option: 'NVENC (H.265)',
      crf_value: 25,
      resolution: '720p',
    })
    const s = useRender.getState()
    expect(s.imagePath).toBe('Z:/cover.png')
    expect(s.encodeOption).toBe('NVENC (H.265)')
    expect(s.crfValue).toBe(25)
    expect(s.resolution).toBe('720p')
    expect(s.encoderUserSet).toBe(true)
  })
})

describe('useRender — job actions', () => {
  it('appendLog ต่อ buffer + ตัดเมื่อเกิน LOG_BUFFER_LIMIT', async () => {
    const { useRender } = await import('../useRender')
    for (let i = 0; i < LOG_BUFFER_LIMIT + 30; i++) {
      useRender.getState().appendLog(`line ${i}`)
    }
    const logs = useRender.getState().logs
    expect(logs.length).toBe(LOG_BUFFER_LIMIT)
    // ของท้าย buffer เป็น line สุดท้ายที่ใส่
    expect(logs[logs.length - 1]).toBe(`line ${LOG_BUFFER_LIMIT + 30 - 1}`)
  })

  it('appendLog ข้าม duplicate ติดกัน', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().appendLog('same')
    useRender.getState().appendLog('same')
    expect(useRender.getState().logs).toEqual(['same'])
  })

  it('appendLog ข้าม empty', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().appendLog('')
    expect(useRender.getState().logs).toEqual([])
  })

  it('resetJob ล้าง progress/logs/error/status', async () => {
    const { useRender } = await import('../useRender')
    const s = useRender.getState()
    s.setBusy(true)
    s.setProgress(0.5)
    s.setStatus('working')
    s.setError('oh no')
    s.appendLog('log line')
    useRender.getState().resetJob()
    const after = useRender.getState()
    expect(after.progress).toBe(0)
    expect(after.error).toBeNull()
    expect(after.status).toBe('พร้อมทำงาน')
    expect(after.logs).toEqual([])
  })
})

describe('useRender — resetForActiveProject', () => {
  it('apply path ของ project + ล้าง queue/logs', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().appendLog('old')
    useRender.getState().setBusy(true)
    useRender.getState().resetForActiveProject('p1', {
      audioRaw: '/audio/raw',
      audioProcessed: '/audio/done',
      renderOutput: '/out',
      covers: '/covers',
    })
    const s = useRender.getState()
    expect(s.audioFolder).toBe('/audio/raw')
    expect(s.audioProcessedFolder).toBe('/audio/done')
    expect(s.outputFolder).toBe('/out')
    expect(s.coverFolder).toBe('/covers')
    expect(s.busy).toBe(false)
    expect(s.logs).toEqual([])
    expect(s.appliedProjectId).toBe('p1')
  })

  it('ไม่ apply ซ้ำถ้า project เดิม', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().resetForActiveProject('p1', { audioRaw: '/a' })
    useRender.getState().setAudioFolder('/changed')
    useRender.getState().resetForActiveProject('p1', { audioRaw: '/b' })
    // path ไม่ revert เพราะ project เดิม
    expect(useRender.getState().audioFolder).toBe('/changed')
  })

  it('projectId=null reset state', async () => {
    const { useRender } = await import('../useRender')
    useRender.getState().resetForActiveProject('p1', { audioRaw: '/a' })
    useRender.getState().resetForActiveProject(null, null)
    const s = useRender.getState()
    expect(s.appliedProjectId).toBeNull()
    expect(s.audioFolder).toBe('')
  })
})
