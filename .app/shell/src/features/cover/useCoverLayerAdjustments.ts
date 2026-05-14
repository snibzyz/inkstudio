import { useCallback, useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type * as fabric from 'fabric'
import {
  DEFAULT_LAYER_ADJUSTMENTS,
  type InkLayerKind,
  type LayerAdjustments,
} from './coverEditorTypes'
import {
  applyAdjustmentsToObject,
  readAdjustmentsFromObject,
} from './coverEditorUtils'

interface Deps {
  fabricRef: MutableRefObject<fabric.Canvas | null>
  selectedObject: (fabric.Object & { inkideaLayerKind?: InkLayerKind }) | null
  selectedLayerId: string | null
  scheduleHistoryCommit: () => void
}

export function useCoverLayerAdjustments({
  fabricRef,
  selectedObject,
  selectedLayerId,
  scheduleHistoryCommit,
}: Deps) {
  const [adjustments, setAdjustments] = useState<LayerAdjustments>({ ...DEFAULT_LAYER_ADJUSTMENTS })

  // When selection changes, read stored adjustments from object
  useEffect(() => {
    setAdjustments(readAdjustmentsFromObject(selectedObject as fabric.Object | null))
  }, [selectedObject, selectedLayerId])

  // Push current adjustments to selected object
  const updateAdjustments = useCallback(
    (patch: Partial<LayerAdjustments>) => {
      setAdjustments((prev) => {
        const next = { ...prev, ...patch }
        const obj = selectedObject
        const c = fabricRef.current
        if (obj && c) {
          applyAdjustmentsToObject(obj, next)
          c.requestRenderAll()
          scheduleHistoryCommit()
        }
        return next
      })
    },
    [fabricRef, scheduleHistoryCommit, selectedObject]
  )

  const resetAdjustments = useCallback(() => {
    const obj = selectedObject
    const c = fabricRef.current
    if (obj && c) {
      applyAdjustmentsToObject(obj, { ...DEFAULT_LAYER_ADJUSTMENTS })
      c.requestRenderAll()
      scheduleHistoryCommit()
    }
    setAdjustments({ ...DEFAULT_LAYER_ADJUSTMENTS })
  }, [fabricRef, scheduleHistoryCommit, selectedObject])

  return { adjustments, updateAdjustments, resetAdjustments }
}
