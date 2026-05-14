/**
 * useRenderJob — bridge ระหว่าง useRender store กับ render:* / fs:* IPC handlers
 *
 * ส่งคืน callbacks ที่ใช้ใน sections — ไม่เก็บ state เอง (state อยู่ใน useRender)
 * Subscribe progress event ครั้งเดียวต่อ mount + cancel job เมื่อ user สลับโหมดออก
 *
 * IPC ที่ใช้:
 *   - fs:list-audio-files    → list audio files ในโฟลเดอร์
 *   - render:start-batch-cover  → เริ่ม render
 *   - render:cancel-job      → หยุด render
 *   - dialog:select-files    → เปิด open dialog
 *   - render:progress event  → progress payload
 *
 * Profile บังคับ: 360p · 1 fps · CRF 30 · Software H.264 · preset ultrafast
 *                  (ค่า fix ทั้งหมดเพื่อความเร็ว — ไม่ให้ user แก้)
 */

import { useCallback, useEffect, useRef } from 'react'
import { useRender } from './useRender'
import { INTRO_VIDEO_EXTENSIONS } from './renderConstants'
import type { ProgressPayload } from './renderTypes'

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
        let msg = `เสร็จ: ${s.successCount}/${s.totalFiles} ไฟล์ · ${formatSeconds(s.elapsedSeconds)}`
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

  const chooseImage = useCallback(async () => {
    if (!electron) return
    const selected = await electron.selectFiles({
      properties: ['openFile'],
      filters: [{ name: 'ไฟล์รูปภาพ', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (selected[0]) useRender.getState().setImagePath(selected[0])
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

  const chooseIntroClip = useCallback(async () => {
    if (!electron) return
    const selected = await electron.selectFiles({
      properties: ['openFile'],
      filters: [{ name: 'ไฟล์วิดีโอ', extensions: [...INTRO_VIDEO_EXTENSIONS] }],
    })
    if (selected[0]) useRender.getState().setIntroClipPath(selected[0])
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
        introClipPath: s.introClipPath || undefined,
        /** profile fix: ทุกค่าตั้งไว้เพื่อความเร็ว + ทรัพยากรน้อย */
        encodeOption: s.encodeOption,
        crfValue: s.crfValue,
        resolutionLabel: s.resolution,
        fps: 1,
        preset: 'ultrafast',
        overwriteMode: 'ask',
        selectedAudioFiles: Array.from(s.selectedAudioFiles),
      })
      let msg = `เสร็จ: ${summary.successCount}/${summary.totalFiles} ไฟล์ · ${formatSeconds(summary.elapsedSeconds)}`
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
    chooseFolder,
    chooseAudioFolder,
    chooseIntroClip,
    startRender,
    cancelRender,
  }
}

export { formatSeconds }
