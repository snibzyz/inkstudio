/**
 * useRenderJob — bridge ระหว่าง useRender store กับ render:* / preset:* / fs:* IPC handlers
 *
 * ส่งคืน callbacks ที่ใช้ใน sections — ไม่เก็บ state เอง (state อยู่ใน useRender)
 * Subscribe progress event ครั้งเดียวต่อ mount + cancel job เมื่อ user สลับโหมดออก
 *
 * IPC ที่ใช้ (read-only contract — ห้ามแก้ใน backend):
 *   - preset:list / preset:save / preset:delete   → store presets
 *   - render:get-preferred-encoder                 → suggested encoder ตาม GPU เครื่อง
 *   - fs:list-audio-files                          → list audio files ในโฟลเดอร์
 *   - render:start-batch-cover                     → เริ่ม render
 *   - render:cancel-job                            → หยุด render
 *   - dialog:select-files                          → เปิด open dialog
 *   - render:progress event                        → progress payload
 */

import { useCallback, useEffect, useRef } from 'react'
import { useHubWorkspace } from '@/state/useHubWorkspace'
import { useRender, buildBatchPresetFromState } from './useRender'
import type { PresetMap, ProgressPayload } from './renderTypes'

function newId() {
  const anyCrypto = typeof crypto !== 'undefined' ? (crypto as unknown as { randomUUID?: () => string }) : undefined
  return anyCrypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function useRenderJob({ programActive }: { programActive: boolean }) {
  const electron = typeof window !== 'undefined' ? window.electron?.ipc : undefined
  const jobIdRef = useRef<string | null>(null)
  const audioFolder = useRender((s) => s.audioFolder)

  /** Hydrate presets + preferred encoder ครั้งแรกเมื่อ component mount */
  useEffect(() => {
    if (!electron) return
    void electron
      .listPresets()
      .then((data) => useRender.getState().setPresets((data as PresetMap) ?? {}))
      .catch(() => useRender.getState().setPresets({}))
    /** auto-detect encoder — ถ้ามี NVIDIA GPU จะใช้ NVENC H.264 (เร็วกว่า + compat)
     *  applyDetectedEncoder จะไม่แก้ทับถ้า user เคยเลือกเองมาก่อน */
    void electron
      .getPreferredEncoder()
      .then((value) => {
        if (typeof value === 'string' && value) {
          useRender.getState().applyDetectedEncoder(value)
        }
      })
      .catch(() => {})
  }, [electron])

  /** Subscribe render:progress event — ตลอดอายุ component */
  useEffect(() => {
    if (!electron?.onRenderProgress || !electron?.offRenderProgress) return
    electron.onRenderProgress((data) => {
      const payload = data as ProgressPayload
      if (!payload || !jobIdRef.current || payload.jobId !== jobIdRef.current) return
      const store = useRender.getState()
      store.setProgress(payload.progress ?? 0)
      store.setStatus(payload.message ?? payload.phase ?? 'กำลังประมวลผล')
      store.setCurrentFile(payload.fileName ?? '')
      if (payload.currentTimeText && payload.durationText) {
        store.setFileProgressText(`${payload.currentTimeText} / ${payload.durationText}`)
      }
      if (payload.etaText) store.setEtaText(`เหลือ: ${payload.etaText}`)
      if (payload.message) store.appendLog(payload.message)
      if (payload.summary) {
        const s = payload.summary
        const project = useHubWorkspace.getState().activeProject
        const projectName = project?.title || project?.slug || 'โปรเจกต์'
        const outputBasename = (store.outputFolder.split(/[\\/]/).pop() || 'output') + '/'
        let msg = `เสร็จ: ${s.successCount}/${s.totalFiles} ไฟล์ · ${formatSeconds(s.elapsedSeconds)} · บันทึกใน ${projectName} ที่ ${outputBasename}`
        if (s.missingCovers.length > 0) msg += `\nข้ามปก: ${s.missingCovers.length} ไฟล์`
        if (s.skippedCount > 0) msg += `\nข้ามซ้ำ: ${s.skippedCount} ไฟล์`
        store.setSummaryText(msg)
      }
    })
    return () => {
      electron.offRenderProgress()
    }
  }, [electron])

  /** ผู้ใช้สลับ mode/tool ออก — cancel job ที่กำลังเดินอยู่ */
  useEffect(() => {
    if (programActive) return
    if (!electron?.cancelRenderJob) return
    const jid = jobIdRef.current
    if (!jid) return
    void electron.cancelRenderJob({ jobId: jid }).finally(() => {
      const store = useRender.getState()
      store.setBusy(false)
      store.setStatus('ยกเลิกการเรนเดอร์แล้ว')
      jobIdRef.current = null
    })
  }, [programActive, electron])

  /** watcher-based (push, ไม่ poll) — เฝ้าดูโฟลเดอร์เสียงที่ active อยู่
   *  ไฟล์เสียงเพิ่ม/ลบ/เปลี่ยนชื่อ → backend ส่ง event 'render:audio-folder-changed' */
  useEffect(() => {
    if (!electron?.watchAudioFolder || !electron?.unwatchAudioFolder) return
    if (audioFolder) {
      void electron.watchAudioFolder({ folderPath: audioFolder })
    } else {
      void electron.unwatchAudioFolder()
    }
    return () => {
      void electron.unwatchAudioFolder?.()
    }
  }, [electron, audioFolder])

  const refreshAudioPreview = useCallback(
    async (overrideFolder?: string) => {
      if (!electron) return
      const store = useRender.getState()
      const target = overrideFolder ?? store.audioFolder
      if (!target) {
        store.setAudioFiles([])
        store.setSelectedAudioFiles(new Set())
        return
      }
      try {
        const files = await electron.listAudioFiles({ folderPath: target })
        store.setAudioFiles(files)
        store.setSelectedAudioFiles((prev) => {
          const next = new Set<string>()
          if (prev.size === 0) {
            for (const f of files) next.add(f)
            return next
          }
          const allowed = new Set(files)
          for (const f of prev) if (allowed.has(f)) next.add(f)
          if (next.size === 0) for (const f of files) next.add(f)
          return next
        })
      } catch {
        store.setAudioFiles([])
        store.setSelectedAudioFiles(new Set())
      }
    },
    [electron]
  )

  /** รับ push event ตอนโฟลเดอร์เสียงเปลี่ยน → โหลดรายการตอนใหม่
   *  รีเฟรชเฉพาะเมื่อ event ตรงโฟลเดอร์ที่กำลังดู และไม่ได้กำลังเรนเดอร์อยู่ */
  useEffect(() => {
    if (!electron?.onAudioFolderChanged || !electron?.offAudioFolderChanged) return
    electron.onAudioFolderChanged((data) => {
      const current = useRender.getState().audioFolder
      if (!current) return
      if (data.folderPath && data.folderPath !== current) return
      if (useRender.getState().busy) return
      void refreshAudioPreview()
    })
    return () => {
      electron.offAudioFolderChanged()
    }
  }, [electron, refreshAudioPreview])

  const chooseImage = useCallback(async () => {
    if (!electron) return
    const selected = await electron.selectFiles({
      properties: ['openFile'],
      filters: [{ name: 'ไฟล์รูปภาพ', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (selected[0]) useRender.getState().setImagePath(selected[0])
  }, [electron])

  const chooseIntro = useCallback(async () => {
    if (!electron) return
    const selected = await electron.selectFiles({
      properties: ['openFile'],
      filters: [{ name: 'ไฟล์วิดีโอ', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi'] }],
    })
    if (selected[0]) {
      const s = useRender.getState()
      s.setIntroPath(selected[0])
      /** เลือกไฟล์ใหม่ = เปิดใช้ intro อัตโนมัติ */
      if (!s.useIntro) s.setUseIntro(true)
    }
  }, [electron])

  const chooseFolder = useCallback(
    async (setter: (v: string) => void) => {
      if (!electron) return
      const selected = await electron.selectFiles({ properties: ['openDirectory'] })
      if (selected[0]) setter(selected[0])
    },
    [electron]
  )

  const chooseAudioFolder = useCallback(async () => {
    if (!electron) return
    const selected = await electron.selectFiles({ properties: ['openDirectory'] })
    const next = selected[0] ?? ''
    if (next) {
      const s = useRender.getState()
      s.setAudioFolder(next)
      s.setAudioSearch('')
      await refreshAudioPreview(next)
    }
  }, [electron, refreshAudioPreview])

  const savePresetCustom = useCallback(async () => {
    if (!electron) return
    const s = useRender.getState()
    const name = s.presetName.trim()
    if (!name) {
      s.setError('กรุณาระบุชื่อพรีเซ็ตก่อนบันทึก')
      return
    }
    const data = buildBatchPresetFromState(s)
    const next = (await electron.savePreset({ name, data })) as PresetMap
    s.setPresets(next)
    s.setSelectedPresetName(name)
    s.setError(null)
    s.setStatus('บันทึกพรีเซ็ตเรียบร้อยแล้ว')
  }, [electron])

  const loadPresetCustom = useCallback(async () => {
    const s = useRender.getState()
    const name = s.selectedPresetName
    if (!name || !s.presets[name]) {
      s.setError('กรุณาเลือกพรีเซ็ตจากรายการก่อน')
      return
    }
    s.applyPreset(s.presets[name])
    s.setError(null)
    s.setStatus('โหลดพรีเซ็ตเรียบร้อยแล้ว')
    await refreshAudioPreview(s.presets[name].audio_folder ?? '')
  }, [refreshAudioPreview])

  const deletePresetCustom = useCallback(async () => {
    if (!electron) return
    const s = useRender.getState()
    if (!s.selectedPresetName) {
      s.setError('กรุณาเลือกพรีเซ็ตที่ต้องการลบก่อน')
      return
    }
    const next = (await electron.deletePreset({ name: s.selectedPresetName })) as PresetMap
    s.setPresets(next)
    s.setSelectedPresetName('')
    s.setStatus('ลบพรีเซ็ตเรียบร้อยแล้ว')
  }, [electron])

  const startRender = useCallback(async () => {
    if (!electron) {
      useRender.getState().setError('กรุณาเปิดใช้งานผ่านแอปพลิเคชันเดสก์ท็อปเท่านั้น')
      return
    }
    const s = useRender.getState()
    if (
      !s.audioFolder ||
      !s.outputFolder ||
      (!s.useMultipleCovers && !s.imagePath) ||
      (s.useMultipleCovers && !s.coverFolder)
    ) {
      s.setError('กรุณาระบุข้อมูลที่จำเป็นให้ครบถ้วนก่อนเริ่มเรนเดอร์')
      return
    }
    if (s.selectedAudioFiles.size === 0) {
      s.setError('กรุณาเลือกไฟล์เสียงอย่างน้อย 1 ไฟล์')
      return
    }
    const jobId = newId()
    jobIdRef.current = jobId
    s.setBusy(true)
    s.setError(null)
    s.setStatus('กำลังเริ่มต้น…')
    s.setProgress(0)
    s.setCurrentFile('')
    s.setFileProgressText('')
    s.setEtaText('')
    s.setSummaryText('')
    /** logs reset — เคลียร์ buffer */
    useRender.setState({ logs: [] })

    try {
      const summary = await electron.startBatchCoverRender({
        jobId,
        imagePath: s.imagePath,
        audioFolder: s.audioFolder,
        /** หลังเรนเดอร์เสร็จ ย้ายไฟล์เสียงต้นทาง → Audio/processed (ถ้ามี) */
        doneFolder: s.audioProcessedFolder || undefined,
        outputFolder: s.outputFolder,
        coverFolder: s.coverFolder,
        useMultipleCovers: s.useMultipleCovers,
        titlePrefix: s.titlePrefix,
        encodeOption: s.encodeOption,
        crfValue: s.crfValue,
        resolutionLabel: s.resolution,
        introPath: s.useIntro ? s.introPath : '',
        overwriteMode: 'ask',
        selectedAudioFiles: Array.from(s.selectedAudioFiles),
      })
      /** เพิ่ม "บันทึกใน <project> ที่ <folder>" ให้ user เห็นว่าวิดีโอออกที่ไหน */
      const project = useHubWorkspace.getState().activeProject
      const projectName = project?.title || project?.slug || 'โปรเจกต์'
      const outputBasename = (s.outputFolder.split(/[\\/]/).pop() || 'output') + '/'
      let msg = `เสร็จ: ${summary.successCount}/${summary.totalFiles} ไฟล์ · ${formatSeconds(summary.elapsedSeconds)} · บันทึกใน ${projectName} ที่ ${outputBasename}`
      if (summary.missingCovers.length > 0) msg += `\nข้ามปก: ${summary.missingCovers.length} ไฟล์`
      if (summary.skippedCount > 0) msg += `\nข้ามซ้ำ: ${summary.skippedCount} ไฟล์`
      const after = useRender.getState()
      after.setSummaryText(msg)
      after.setStatus('เรนเดอร์เสร็จสมบูรณ์')
      after.setProgress(1)
      await refreshAudioPreview()
    } catch (e) {
      const after = useRender.getState()
      after.setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเรนเดอร์')
      after.setStatus('เกิดข้อผิดพลาด')
    } finally {
      useRender.getState().setBusy(false)
      jobIdRef.current = null
    }
  }, [electron, refreshAudioPreview])

  const cancelRender = useCallback(async () => {
    if (!electron || !jobIdRef.current) return
    await electron.cancelRenderJob({ jobId: jobIdRef.current })
    const s = useRender.getState()
    s.setBusy(false)
    s.setStatus('ยกเลิกการเรนเดอร์แล้ว')
    jobIdRef.current = null
  }, [electron])

  return {
    refreshAudioPreview,
    chooseImage,
    chooseIntro,
    chooseFolder,
    chooseAudioFolder,
    savePresetCustom,
    loadPresetCustom,
    deletePresetCustom,
    startRender,
    cancelRender,
  }
}

export { formatSeconds }
