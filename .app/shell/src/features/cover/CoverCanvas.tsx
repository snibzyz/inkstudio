import { useEffect, useMemo, useRef } from 'react'
import { drawCover } from './coverRender'
import { useCoverState } from './useCoverState'

/** Canvas video frame 1280×720 — preview ใช้ขนาดจริง (browser จะ scale ลงด้วย CSS) */
export const PREVIEW_W = 1280
export const PREVIEW_H = 720

export function CoverCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseImage = useCoverState((s) => s.baseImage)
  const background = useCoverState((s) => s.background)
  const foreground = useCoverState((s) => s.foreground)
  const title = useCoverState((s) => s.title)
  const chapter = useCoverState((s) => s.chapter)
  const previewChapter = useCoverState((s) => s.previewChapter)
  const padding = useCoverState((s) => s.batch.padding)

  const imgElement = useMemo(() => {
    if (!baseImage?.dataUrl) return null
    const img = new Image()
    img.src = baseImage.dataUrl
    return img
  }, [baseImage?.dataUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = PREVIEW_W
    canvas.height = PREVIEW_H

    const renderOnce = () =>
      drawCover(ctx, {
        baseImage: imgElement,
        background,
        foreground,
        title,
        chapter,
        chapterNumber: previewChapter,
        padding,
      })

    if (imgElement && !imgElement.complete) {
      const onLoad = () => renderOnce()
      imgElement.addEventListener('load', onLoad, { once: true })
      renderOnce()
      return () => imgElement.removeEventListener('load', onLoad)
    }

    renderOnce()
  }, [imgElement, background, foreground, title, chapter, previewChapter, padding])

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_W}
      height={PREVIEW_H}
      className="aspect-video h-auto w-full max-w-full rounded-sm border border-vscode-border bg-black shadow-mac"
      aria-label="ตัวอย่างปก 1280×720"
    />
  )
}
