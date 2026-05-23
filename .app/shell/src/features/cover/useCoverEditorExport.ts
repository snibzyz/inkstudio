import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as fabric from 'fabric'
import { clamp, zeroPad, withDirSep, exportPngDataUrlWithQuality } from './coverEditorUtils'
import { CANVAS_W, CANVAS_H } from './coverEditorTypes'

interface ExportDeps {
  fabricRef: MutableRefObject<fabric.Canvas | null>
  numberLayerIdRef: MutableRefObject<string | null>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  electron: any
  setBusy: (v: boolean) => void
  setError: (v: string | null) => void
  defaultExportFolder?: string
  projectStorageKey?: string
}

export function useCoverEditorExport({ fabricRef, numberLayerIdRef, electron, setBusy, setError, defaultExportFolder = '', projectStorageKey = '' }: ExportDeps) {
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpg'>('png')
  const [quality, setQuality] = useState<number>(75)
  const [batchStart, setBatchStart] = useState<number>(1)
  const [batchEnd, setBatchEnd] = useState<number>(50)
  const [batchLength, setBatchLength] = useState<number>(50)
  const [batchPadding, setBatchPadding] = useState<number>(4)
  const [batchOutputFolder, setBatchOutputFolder] = useState<string>(() => {
    if (projectStorageKey) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(projectStorageKey) : null
      if (saved) return saved
    }
    return defaultExportFolder
  })

  useEffect(() => {
    if (!projectStorageKey || !batchOutputFolder) return
    localStorage.setItem(projectStorageKey, batchOutputFolder)
  }, [batchOutputFolder, projectStorageKey])

  useEffect(() => {
    if (!defaultExportFolder) return
    setBatchOutputFolder((prev) => (prev ? prev : defaultExportFolder))
  }, [defaultExportFolder])

  const [exportStatus, setExportStatus] = useState<string>('')
  const [batchProgress, setBatchProgress] = useState(0)

  // Find Number layer by label first (matches legacy script approach), fall back to ID ref
  function getNumberTextbox(): fabric.Textbox | null {
    const c = fabricRef.current
    if (!c) return null

    // Primary: search by label 'Number' — same as legacy "doc.layers.getByName('Number')"
    const byLabel = c.getObjects().find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => (o as any).inkideaLayerLabel === 'Number'
    )
    if (byLabel instanceof fabric.Textbox) {
      // Keep ref in sync
      numberLayerIdRef.current = (byLabel as any).inkideaLayerId ?? numberLayerIdRef.current
      return byLabel
    }

    // Fallback: by stored ID ref
    const id = numberLayerIdRef.current
    if (!id) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = c.getObjects().find((o: any) => (o as any).inkideaLayerId === id)
    if (byId instanceof fabric.Textbox) return byId

    return null
  }

  function setNumberText(obj: fabric.Textbox, text: string) {
    obj.set('text', text)
    // Force Fabric.js 7 to recalculate text layout before next renderAll
    if (typeof (obj as any).initDimensions === 'function') {
      ;(obj as any).initDimensions()
    }
    obj.dirty = true
  }

  function withFullResCanvas<T>(fn: (c: fabric.Canvas) => T): T | null {
    const c = fabricRef.current
    if (!c) return null
    const oldVP = [...(c.viewportTransform ?? [1, 0, 0, 1, 0, 0])] as [number, number, number, number, number, number]
    const oldW = c.width ?? CANVAS_W
    const oldH = c.height ?? CANVAS_H
    c.setDimensions({ width: CANVAS_W, height: CANVAS_H })
    c.setViewportTransform([1, 0, 0, 1, 0, 0])
    c.renderAll()
    try {
      return fn(c)
    } finally {
      c.setDimensions({ width: oldW, height: oldH })
      c.setViewportTransform(oldVP)
      c.requestRenderAll()
    }
  }

  async function exportSingle() {
    const c = fabricRef.current
    if (!c || !electron) return
    setExportStatus('')
    setError(null)
    setBusy(true)
    try {
      const numberObj = getNumberTextbox()
      if (!numberObj) { setError('ไม่พบเลเยอร์ชื่อ "Number" — กรุณาตรวจสอบเลเยอร์บนแคนวาส'); return }
      const fileBaseName = String(numberObj.text ?? '').trim() || 'cover'
      const ext = outputFormat === 'png' ? 'png' : 'jpg'
      const outputPath = await electron.savePath({
        defaultPath: `${fileBaseName}.${ext}`,
        filters: [{ name: 'ไฟล์ภาพ', extensions: [ext] }],
      })
      if (!outputPath) return
      const dataUrl = withFullResCanvas((fc) =>
        outputFormat === 'png'
          ? exportPngDataUrlWithQuality(fc, quality)
          : fc.toDataURL({ format: 'jpeg', multiplier: 1, quality: clamp(quality / 100, 0, 1) })
      )
      if (!dataUrl) return
      await electron.exportCoverPng({ dataUrl, outputPath })
      const outBasename = outputPath.split(/[\\/]/).pop() || 'ปก'
      const outFolder = outputPath.split(/[\\/]/).slice(-2, -1)[0] || ''
      setExportStatus(outFolder ? `บันทึก ${outBasename} ที่ ${outFolder}/` : `บันทึก ${outBasename}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการส่งออก')
    } finally {
      setBusy(false)
    }
  }

  async function exportBatch() {
    const c = fabricRef.current
    if (!c || !electron) return
    setError(null)
    setExportStatus('')
    setBusy(true)

    const start = Math.floor(batchStart)
    const end = Math.floor(batchEnd)
    const len = Math.floor(batchLength)
    const pad = Math.floor(batchPadding)

    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(len) || len <= 0) {
      setError('กรุณากำหนดค่า เริ่มต้น/สิ้นสุด/จำนวนภาพต่อชุดให้ถูกต้อง')
      setBusy(false); return
    }
    if (end < start) { setError('ช่วงตัวเลขไม่ถูกต้อง'); setBusy(false); return }

    const folder = batchOutputFolder || (await electron.selectFiles({ properties: ['openDirectory'] })).at(0)
    if (!folder) { setError('กรุณาเลือกโฟลเดอร์ปลายทาง'); setBusy(false); return }

    const numberObj = getNumberTextbox()
    if (!numberObj) {
      setError('ไม่พบเลเยอร์ชื่อ "Number" — กรุณาตรวจสอบเลเยอร์บนแคนวาส')
      setBusy(false); return
    }

    const originalText = String(numberObj.text ?? '')
    const totalItems = Math.ceil((end - start + 1) / len)
    let exportedCount = 0
    setBatchProgress(0)

    try {
      for (let i = start; i <= end; i += len) {
        const rangeEnd = Math.min(i + len - 1, end)
        const textVal = `${zeroPad(i, pad)}-${zeroPad(rangeEnd, pad)}`
        const ext = outputFormat === 'png' ? 'png' : 'jpg'

        // Update Number layer text, force Fabric.js 7 re-layout
        setNumberText(numberObj, textVal)

        const dataUrl = withFullResCanvas((fc) =>
          outputFormat === 'png'
            ? exportPngDataUrlWithQuality(fc, quality)
            : fc.toDataURL({ format: 'jpeg', multiplier: 1, quality: clamp(quality / 100, 0, 1) })
        )
        if (!dataUrl) break

        const outputPath = `${withDirSep(folder)}${textVal}.${ext}`
        await electron.exportCoverPng({ dataUrl, outputPath })

        exportedCount += 1
        setBatchProgress(exportedCount / totalItems)
        setExportStatus(`กำลังส่งออก ${exportedCount}/${totalItems}: ${textVal}.${ext}`)
      }

      // Restore original text
      setNumberText(numberObj, originalText)
      c.requestRenderAll()
      const folderBasename = folder.split(/[\\/]/).pop() || ''
      setExportStatus(
        folderBasename
          ? `ส่งออกเสร็จ ${exportedCount} ไฟล์ที่ ${folderBasename}/`
          : `ส่งออกเสร็จ ${exportedCount} ไฟล์`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการส่งออกแบบแบตช์')
    } finally {
      setBusy(false)
      setBatchProgress(0)
    }
  }

  async function chooseFolder(setter: (value: string) => void) {
    if (!electron) return
    const selected = await electron.selectFiles({ properties: ['openDirectory'] })
    if (selected[0]) setter(selected[0])
  }

  return {
    outputFormat, setOutputFormat, quality, setQuality,
    batchStart, setBatchStart, batchEnd, setBatchEnd,
    batchLength, setBatchLength, batchPadding, setBatchPadding,
    batchOutputFolder, setBatchOutputFolder,
    exportStatus, batchProgress,
    exportSingle, exportBatch, chooseFolder,
  }
}
