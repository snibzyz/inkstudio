import * as fabric from 'fabric'
import { CANVAS_W, CANVAS_H } from './coverEditorTypes'

// Snap zone in screen pixels — converts to artboard units using current zoom
const SNAP_SCREEN_PX = 8
const GUIDE_COLOR = '#38bdf8'

interface GuideState {
  v: number[]  // artboard X coordinates of active vertical guides
  h: number[]  // artboard Y coordinates of active horizontal guides
}

function getObjBBoxArtboard(obj: fabric.Object): { left: number; top: number; right: number; bottom: number; cx: number; cy: number } | null {
  try {
    // getCoords() without arguments returns corner points in artboard/canvas space
    const coords = obj.getCoords()
    const xs = coords.map((p) => p.x)
    const ys = coords.map((p) => p.y)
    const left = Math.min(...xs)
    const top = Math.min(...ys)
    const right = Math.max(...xs)
    const bottom = Math.max(...ys)
    return { left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 }
  } catch {
    return null
  }
}

export function attachSmartGuides(canvas: fabric.Canvas): () => void {
  const state: GuideState = { v: [], h: [] }

  function clearGuides() {
    if (state.v.length === 0 && state.h.length === 0) return
    state.v = []
    state.h = []
    canvas.requestRenderAll()
  }

  // Draws guides in screen pixel space after Fabric renders objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onAfterRender = ({ ctx }: any) => {
    if (state.v.length === 0 && state.h.length === 0) return
    const vp = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const zoom = vp[0]
    const panX = vp[4]
    const panY = vp[5]
    const cw = canvas.width ?? CANVAS_W
    const ch = canvas.height ?? CANVAS_H

    ctx.save()
    ctx.strokeStyle = GUIDE_COLOR
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.9
    ctx.setLineDash([])

    // Convert artboard X → screen X: x * zoom + panX
    for (const gx of state.v) {
      const sx = Math.round(gx * zoom + panX) + 0.5
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, ch)
      ctx.stroke()
    }
    // Convert artboard Y → screen Y: y * zoom + panY
    for (const gy of state.h) {
      const sy = Math.round(gy * zoom + panY) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(cw, sy)
      ctx.stroke()
    }
    ctx.restore()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onObjectMoving = (e: any) => {
    const target: fabric.Object = e.target
    if (!target) return

    // Ensure corners reflect the current drag position in artboard space
    target.setCoords()
    const bbox = getObjBBoxArtboard(target)
    if (!bbox) { clearGuides(); return }

    const vp = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const zoom = vp[0]
    // Snap threshold in artboard units, scaled from screen pixels
    const snapThresh = SNAP_SCREEN_PX / Math.max(zoom, 0.01)

    // Snap targets (artboard space): artboard edges/center + other visible objects
    const vTargets: number[] = [0, CANVAS_W / 2, CANVAS_W]
    const hTargets: number[] = [0, CANVAS_H / 2, CANVAS_H]

    for (const obj of canvas.getObjects()) {
      if (obj === target) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((obj as any).inkideaLayerKind === 'background') continue
      const b = getObjBBoxArtboard(obj)
      if (!b) continue
      vTargets.push(b.left, b.cx, b.right)
      hTargets.push(b.top, b.cy, b.bottom)
    }

    const newV: number[] = []
    const newH: number[] = []

    // X snap: find (source point, target) pair with smallest distance
    const xPoints = [bbox.left, bbox.cx, bbox.right]
    let bestDX = snapThresh + 1
    let bestGX: number | null = null
    let bestXSrc: number | null = null
    for (const mx of xPoints) {
      for (const tx of vTargets) {
        const d = Math.abs(mx - tx)
        if (d < bestDX) { bestDX = d; bestGX = tx; bestXSrc = mx }
      }
    }
    if (bestGX !== null && bestXSrc !== null) {
      // Shift left/top by delta in artboard space
      target.set({ left: (target.left ?? 0) + (bestGX - bestXSrc) })
      newV.push(bestGX)
    }

    // Recompute bbox after X snap before checking Y
    target.setCoords()
    const bbox2 = getObjBBoxArtboard(target) ?? bbox
    const yPoints = [bbox2.top, bbox2.cy, bbox2.bottom]
    let bestDY = snapThresh + 1
    let bestGY: number | null = null
    let bestYSrc: number | null = null
    for (const my of yPoints) {
      for (const ty of hTargets) {
        const d = Math.abs(my - ty)
        if (d < bestDY) { bestDY = d; bestGY = ty; bestYSrc = my }
      }
    }
    if (bestGY !== null && bestYSrc !== null) {
      target.set({ top: (target.top ?? 0) + (bestGY - bestYSrc) })
      newH.push(bestGY)
    }
    target.setCoords()

    state.v = newV
    state.h = newH
    if (newV.length > 0 || newH.length > 0) canvas.requestRenderAll()
  }

  canvas.on('after:render', onAfterRender)
  canvas.on('object:moving', onObjectMoving)
  canvas.on('object:modified', clearGuides)
  canvas.on('selection:cleared', clearGuides)
  canvas.on('mouse:up', clearGuides)

  return () => {
    canvas.off('after:render', onAfterRender)
    canvas.off('object:moving', onObjectMoving)
    canvas.off('object:modified', clearGuides)
    canvas.off('selection:cleared', clearGuides)
    canvas.off('mouse:up', clearGuides)
  }
}
