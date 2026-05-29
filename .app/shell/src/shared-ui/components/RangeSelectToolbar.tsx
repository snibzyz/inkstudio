/**
 * RangeSelectToolbar — ช่วยเลือกไฟล์เป็นช่วงตอน (ใช้ใน RenderTab/AudioTab/Explorer)
 *
 * UI:
 *   [ช่วงตอน] [input "1-50, 100-200"] [ปุ่มเลือก]    [เลือกทีละ] [input N] [toggle เปิด/ปิด]
 *
 * Surface ที่ใช้ต้อง:
 *   1. ผูก batchMode + batchSize เป็น state ของตัวเอง (controlled)
 *   2. ตอน batchMode=ON และผู้ใช้คลิก row → เรียก toggleBatchSelection() เอง
 *      (toolbar ไม่ intercept คลิก row โดยตรง — surface จัดเอง)
 *
 * Range mode = แทนที่ selection ทั้งหมดด้วย items ที่ตอนอยู่ในช่วง
 */

import { useState } from 'react'
import { cn } from '../utils/cn'
import { selectionFromRange, type RangeItem } from '../utils/rangeSelectLogic'
import { Codicon } from './Codicon'
import {
  HubSettingsButton,
  HubSettingsInput,
} from './hubSettings/HubSettingsControls'

export interface RangeSelectToolbarProps {
  /** ไอเทมในลำดับปัจจุบัน — id + chapter ที่ parse จากชื่อ */
  items: ReadonlyArray<RangeItem>
  /** แทนที่ selection ทั้งหมดด้วย Set ใหม่ */
  onReplaceSelection: (next: Set<string>) => void

  /** batch mode props — optional ถ้า hideBatch=true */
  batchMode?: boolean
  onBatchModeChange?: (on: boolean) => void
  batchSize?: number
  onBatchSizeChange?: (n: number) => void

  disabled?: boolean
  className?: string
  /** label "ช่วงตอน" สามารถ override ได้ */
  rangeLabel?: string
  /** ซ่อนส่วน batch mode — ใช้ใน dialog ที่คลิก row ไม่ได้ */
  hideBatch?: boolean
  /** auto-focus ที่ input range — ใช้กับ dialog */
  autoFocus?: boolean
}

export function RangeSelectToolbar({
  items,
  onReplaceSelection,
  batchMode = false,
  onBatchModeChange,
  batchSize = 10,
  onBatchSizeChange,
  disabled,
  className,
  rangeLabel = 'ช่วงตอน',
  hideBatch = false,
  autoFocus = false,
}: RangeSelectToolbarProps) {
  const [rangeText, setRangeText] = useState('')

  const itemsWithChapter = items.reduce((n, it) => (it.chapter != null ? n + 1 : n), 0)
  const noChapters = itemsWithChapter === 0
  const canShowBatch = !hideBatch && onBatchModeChange && onBatchSizeChange

  const applyRange = () => {
    if (!rangeText.trim() || noChapters) return
    onReplaceSelection(selectionFromRange(rangeText, items))
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-sm border border-vscode-border bg-vscode-input/15 px-2.5 py-1.5',
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <Codicon name="list-selection" className="text-vscode-muted" />
        <span className="text-[11px] font-semibold text-vscode-fg-bright">{rangeLabel}</span>
        <HubSettingsInput
          value={rangeText}
          onChange={(e) => setRangeText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyRange() }}
          placeholder="เช่น 1-50, 100-200"
          disabled={disabled || noChapters}
          className="w-44"
          aria-label="กรอกช่วงตอน"
          autoFocus={autoFocus}
        />
        <HubSettingsButton
          size="sm"
          tone="primary"
          onClick={applyRange}
          disabled={disabled || !rangeText.trim() || noChapters}
          title="แทนที่การเลือกด้วยตอนในช่วงนี้"
        >
          เลือก
        </HubSettingsButton>
      </div>

      {canShowBatch ? (
        <>
          <span className="h-4 w-px shrink-0 bg-vscode-border" aria-hidden />
          <div className="flex items-center gap-1.5">
            <Codicon name="symbol-numeric" className="text-vscode-muted" />
            <span className="text-[11px] font-semibold text-vscode-fg-bright">เลือกทีละ</span>
            <HubSettingsInput
              type="number"
              min={1}
              value={batchSize}
              onChange={(e) => onBatchSizeChange?.(Math.max(1, Number(e.target.value) || 1))}
              disabled={disabled}
              className="w-16"
              aria-label="จำนวนตอนต่อกลุ่ม"
            />
            <HubSettingsButton
              size="sm"
              tone={batchMode ? 'primary' : 'secondary'}
              onClick={() => onBatchModeChange?.(!batchMode)}
              disabled={disabled}
              title={
                batchMode
                  ? 'ปิดโหมดเลือกทีละกลุ่ม'
                  : `เปิด: คลิกที่ตอนใด ๆ → เลือกตอนนั้นและถัดไปอีก ${batchSize - 1} ตอน`
              }
              icon={<Codicon name={batchMode ? 'circle-filled' : 'circle-large-outline'} />}
            >
              {batchMode ? 'เปิด' : 'ปิด'}
            </HubSettingsButton>
          </div>
        </>
      ) : null}

      {canShowBatch && batchMode ? (
        <span className="basis-full text-[11px] text-vscode-muted sm:basis-auto">
          คลิกที่ตอน → เลือกตอนนั้นและถัดไปอีก {batchSize - 1} ตอน · คลิกซ้ำ = ยกเลิก
        </span>
      ) : noChapters ? (
        <span className="basis-full text-[11px] text-vscode-muted sm:basis-auto">
          ชื่อไฟล์ไม่มีเลขตอน — ใช้ช่วงตอนไม่ได้
        </span>
      ) : null}
    </div>
  )
}
