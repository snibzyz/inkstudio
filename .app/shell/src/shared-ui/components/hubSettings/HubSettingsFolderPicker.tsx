import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import { Codicon } from '../Codicon'

export type FolderPickerOption = {
  /** workspace-relative path */
  rel: string
  /** ฉลากแสดงผล เช่น 'Raw (ต้นฉบับ)' */
  label?: string
}

/** ฉลากภาษาไทยของ standard folder basenames — ใช้เป็น fallback friendly label เมื่อไม่ตรงกับ options ใด */
const STANDARD_BASENAME_LABEL: Record<string, string> = {
  Raw: 'Raw (ต้นฉบับ)',
  Input: 'Input (ตรวจ)',
  Fix: 'Fix (แก้ไข)',
  Clean: 'Clean (เกลา)',
  Merge: 'Merge (รวมไฟล์)',
  Separate: 'Separate (แยกไฟล์)',
  Error: 'Error (ข้อผิดพลาด)',
  Temp: 'Temp (ชั่วคราว)',
  Finish: 'Finish (เสร็จรอบ)',
  Audio: 'Audio (เสียง)',
  Cover: 'Cover (ปก)',
  Covers: 'Covers (ปก)',
  Prompt: 'Prompt (พร้อมพ์)',
  Prompts: 'Prompts (พร้อมพ์)',
  Style: 'Style (สำนวน)',
  Styles: 'Styles (สำนวน)',
  Video: 'Video (คลิป)',
  Videos: 'Videos (คลิป)',
  Vocab: 'Vocab (คำศัพท์)',
  Vocabs: 'Vocabs (คำศัพท์)',
  Glossary: 'Glossary (คำศัพท์)',
  Render: 'Render (คลิป)',
  Renders: 'Renders (คลิป)',
}

/** strip `project/<id>/` prefix + apply ฉลากไทยให้ basename → "Raw (ต้นฉบับ)" / "Audio (เสียง)/sub" */
function autoFriendlyLabel(rel: string): string {
  if (!rel) return ''
  let stripped = rel
  const m = rel.match(/^project\/[^/]+\/(.+)$/)
  if (m) stripped = m[1]
  if (!stripped) return ''
  const parts = stripped.split('/')
  const firstLabel = STANDARD_BASENAME_LABEL[parts[0]] ?? parts[0]
  return parts.length === 1 ? firstLabel : `${firstLabel}/${parts.slice(1).join('/')}`
}

/**
 * HubFolderPicker — ตัวเลือกโฟลเดอร์มาตรฐานใน Hub Settings
 *
 * UI:
 *  - input field พร้อม custom dropdown (popover) — แสดง friendly label เมื่อไม่ focus, raw path เมื่อ focus
 *  - keyboard: ArrowDown/ArrowUp navigate, Enter pick, Esc close
 *  - ปุ่มมาตรฐาน 3 ตัว: **เลือก** (browse) · **เปิด** (open in OS) · **โหลด** (reload list/files)
 *  - mode readOnly — แสดง path เป็น read-only chip + ปุ่ม "เปิด"
 *
 * Pattern: ใช้ทุกที่ใน app เพื่อ standardize folder selection UX
 */
export function HubSettingsFolderPicker({
  label,
  value,
  onChange,
  options = [],
  icon,
  onOpen,
  onBrowse,
  onReload,
  readOnly = false,
  placeholder,
  className,
  badge,
  defaultRel,
  displayLabel,
}: {
  /** ป้ายหน้าฟิลด์ เช่น 'ไฟล์นำเข้า' */
  label: ReactNode
  /** path สัมพันธ์ (workspace-relative) ปัจจุบัน */
  value: string
  /** เปลี่ยน path — ถ้าไม่ใส่ = readonly */
  onChange?: (next: string) => void
  /** suggestions ที่จะโผล่ใน dropdown */
  options?: FolderPickerOption[]
  /** ไอคอนหน้า label */
  icon?: ReactNode
  /** เปิด path ปัจจุบันใน OS file manager — ใส่ก็แสดงปุ่ม "เปิด" */
  onOpen?: () => void
  /** Browse handler — ใส่ก็แสดงปุ่ม "เลือก" (browse) */
  onBrowse?: () => void | Promise<void>
  /** Reload handler — ใส่ก็แสดงปุ่ม "โหลด" (refresh folder list + ไฟล์ในโฟลเดอร์) */
  onReload?: () => void | Promise<void>
  /** บังคับ readonly แม้มี onChange (ใช้กับ display field) */
  readOnly?: boolean
  placeholder?: string
  className?: string
  /** chip เล็ก ๆ ทางขวาของ label เช่น เลขโปรเจกต์ */
  badge?: ReactNode
  /** Path ค่าเริ่มต้นของ feature นี้ — แสดง chip 'ค่าเริ่มต้น' + ปุ่ม reset เมื่อ value เปลี่ยน */
  defaultRel?: string
  /** override ฉลาก (ถ้าไม่ใส่: derive จาก options ที่ match value → ถ้าไม่ match จะ apply built-in Thai naming map) */
  displayLabel?: string
}) {
  const editable = !readOnly && Boolean(onChange)
  const isAtDefault = defaultRel !== undefined && value === defaultRel
  const canReset = editable && defaultRel !== undefined && value !== defaultRel

  /** label ที่จะแสดง (ไม่ focus) — ลำดับ priority:
   *  1) displayLabel ที่ caller ส่งมา
   *  2) label ของ option ที่ rel ตรงกับ value
   *  3) auto-friendly จาก basename (Raw → "Raw (ต้นฉบับ)") */
  const matchedOption = options.find((o) => o.rel === value)
  const effectiveLabel = displayLabel ?? matchedOption?.label ?? autoFriendlyLabel(value)

  return (
    <div className={cn('flex min-h-8 flex-wrap items-center gap-2', className)} title={value || undefined}>
      {icon ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center text-vscode-muted" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-[88px] shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-vscode-muted">
        {label}
        {badge}
        {isAtDefault ? (
          <span
            className="ml-0.5 inline-flex items-center gap-0.5 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-1 py-0 text-[9px] font-bold tracking-wider text-emerald-300"
            title="กำลังใช้ค่าเริ่มต้นของระบบ"
          >
            <Codicon name="star-full" size={9} />
            ค่าเริ่มต้น
          </span>
        ) : null}
      </span>

      {editable ? (
        <FolderCombobox
          value={value}
          onChange={onChange!}
          options={options}
          placeholder={placeholder}
          defaultRel={defaultRel}
          displayLabel={effectiveLabel}
        />
      ) : (
        <div
          title={value}
          className="flex-1 min-w-[140px] rounded-sm border border-vscode-border/60 bg-vscode-sidebar/60 px-2 py-1.5 text-[12px] text-vscode-fg"
        >
          {value
            ? <span className={effectiveLabel ? 'font-semibold' : 'font-mono break-all'}>{effectiveLabel || value}</span>
            : <span className="text-vscode-muted italic">{placeholder || '— ยังไม่ได้เลือก —'}</span>
          }
        </div>
      )}

      {canReset ? (
        <button
          type="button"
          onClick={() => onChange?.(defaultRel!)}
          title={`รีเซ็ตเป็นค่าเริ่มต้น "${defaultRel}"`}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10.5px] text-amber-300 hover:bg-amber-500/20"
        >
          <Codicon name="discard" size={12} />
          <span>รีเซ็ต</span>
        </button>
      ) : null}

      {onBrowse ? (
        <button
          type="button"
          onClick={() => void onBrowse()}
          title="เลือกโฟลเดอร์จากเครื่อง"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-vscode-border bg-vscode-button px-1.5 text-[10.5px] text-vscode-fg hover:bg-vscode-list-hover"
        >
          <Codicon name="folder-library" size={12} />
          <span>เลือก</span>
        </button>
      ) : null}

      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          disabled={!value}
          title={value ? `เปิดโฟลเดอร์ "${value}" ใน Explorer` : 'ยังไม่ได้เลือกโฟลเดอร์'}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-vscode-border bg-vscode-button px-1.5 text-[10.5px] text-vscode-fg hover:bg-vscode-list-hover disabled:opacity-45"
        >
          <Codicon name="folder-opened" size={12} />
          <span>เปิด</span>
        </button>
      ) : null}

      {onReload ? (
        <button
          type="button"
          onClick={() => void onReload()}
          title="โหลดรายชื่อโฟลเดอร์และไฟล์ใหม่อีกครั้ง"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border border-vscode-border bg-vscode-button px-1.5 text-[10.5px] text-vscode-fg hover:bg-vscode-list-hover"
        >
          <Codicon name="refresh" size={12} />
          <span>โหลด</span>
        </button>
      ) : null}
    </div>
  )
}

/**
 * Custom combobox — input + filterable popover + keyboard nav
 * - Popover แสดงผ่าน portal เพื่อ overflow tab/panel ที่ clip ได้
 */
function FolderCombobox({
  value,
  onChange,
  options,
  placeholder,
  defaultRel,
  displayLabel,
}: {
  value: string
  onChange: (next: string) => void
  options: FolderPickerOption[]
  placeholder?: string
  defaultRel?: string
  /** ฉลากที่จะแสดงในช่อง input แทน raw path — เมื่อ user focus จะกลับเป็น raw เพื่อแก้ได้ */
  displayLabel?: string
}) {
  const id = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [filterText, setFilterText] = useState('')
  const [popoverRect, setPopoverRect] = useState<{ left: number; top: number; width: number } | null>(null)

  /** Filter options ตาม filterText (substring match บน rel + label) */
  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => {
      if (o.rel.toLowerCase().includes(q)) return true
      if (o.label && o.label.toLowerCase().includes(q)) return true
      return false
    })
  }, [filterText, options])

  /** Sync filterText กับ value ตอนเปิด — แสดง all options ก่อน user พิมพ์ filter */
  useEffect(() => {
    if (open) setFilterText('')
  }, [open])

  /** คำนวณตำแหน่ง popover (anchor ที่ input bottom) */
  useEffect(() => {
    if (!open || !containerRef.current) return
    const update = () => {
      const r = containerRef.current!.getBoundingClientRect()
      setPopoverRect({ left: r.left, top: r.bottom + 4, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  /** ปิด popover เมื่อคลิกนอก */
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (!t) return
      if (containerRef.current?.contains(t)) return
      if (listRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer, true)
    return () => window.removeEventListener('pointerdown', onPointer, true)
  }, [open])

  /** Scroll active item เข้า view */
  useEffect(() => {
    if (!open || !listRef.current) return
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIdx])

  function commitSelection(rel: string) {
    onChange(rel)
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); setActiveIdx(0); return }
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (open && filtered[activeIdx]) {
        e.preventDefault()
        commitSelection(filtered[activeIdx].rel)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation() // กัน modal ที่ครอบ picker ปิดตามไปด้วย
        setOpen(false)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[160px]">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          /** ลำดับการแสดง:
           *   - ไม่ focus → displayLabel (friendly) ถ้ามี ไม่งั้น raw value
           *   - focus + ยังไม่พิมพ์ filter → displayLabel (อ่านง่ายต่อ ไม่ขโมยพื้นที่)
           *   - focus + พิมพ์ filter → ข้อความที่ user พิมพ์ (เป็น filter / custom path) */
          value={open && filterText !== '' ? filterText : (displayLabel || value)}
          placeholder={placeholder}
          onChange={(e) => {
            const txt = e.target.value
            setFilterText(txt)
            onChange(txt)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          role="combobox"
          className={cn(
            'w-full rounded-sm border border-vscode-border bg-vscode-sidebar/80 pl-2 pr-7 py-1.5 text-[12px] text-vscode-fg',
            !filterText && displayLabel ? 'font-semibold' : 'font-mono',
            'outline-none transition-[border-color,box-shadow] focus:border-vscode-focus focus:ring-1 focus:ring-vscode-focus/35'
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          /** chevron toggle:
           *   - open → close + blur (กัน input onFocus re-open)
           *   - close → open + focus (เพื่อให้ keyboard nav ใช้ได้ทันที) */
          onClick={() => {
            if (open) {
              setOpen(false)
              inputRef.current?.blur()
            } else {
              setOpen(true)
              inputRef.current?.focus()
            }
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-sm text-vscode-muted hover:bg-vscode-list-hover hover:text-vscode-fg"
          aria-label="แสดงรายการโฟลเดอร์"
          title="แสดงรายการโฟลเดอร์ทั้งหมด"
        >
          <Codicon name={open ? 'chevron-up' : 'chevron-down'} size={12} />
        </button>
      </div>

      {open && popoverRect
        ? createPortal(
            <div
              ref={listRef}
              id={`${id}-list`}
              role="listbox"
              className="z-[280] max-h-72 overflow-y-auto rounded-sm border border-vscode-border bg-vscode-surface shadow-lg [scrollbar-width:thin]"
              style={{
                position: 'fixed',
                left: popoverRect.left,
                top: popoverRect.top,
                width: popoverRect.width,
              }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-center text-[11.5px] text-vscode-muted">
                  {options.length === 0
                    ? <><Codicon name="loading" spin size={12} /> กำลังโหลดรายการโฟลเดอร์… กด "โหลด" เพื่อรีเฟรช</>
                    : <>ไม่พบโฟลเดอร์ที่ตรงกับ "{filterText}"</>}
                </div>
              ) : null}
              {filtered.map((opt, idx) => {
                const isActive = idx === activeIdx
                const isSelected = opt.rel === value
                const isDefault = defaultRel !== undefined && opt.rel === defaultRel
                /** depth สำหรับ indent — `project/<id>/X` = top-level (0), ลึกขึ้น = nested */
                const depth = Math.max(0, opt.rel.split('/').length - 2)
                return (
                  <button
                    key={opt.rel}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-idx={idx}
                    onClick={() => commitSelection(opt.rel)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] transition-colors',
                      isActive ? 'bg-vscode-list-active text-vscode-fg-bright' : 'text-vscode-fg hover:bg-vscode-list-hover'
                    )}
                    style={depth > 0 ? { paddingLeft: 10 + depth * 12 } : undefined}
                  >
                    <Codicon
                      name={isSelected ? 'check' : depth === 0 ? 'folder-active' : 'folder'}
                      size={14}
                      className={cn('shrink-0', isSelected ? 'text-vscode-focus' : depth === 0 ? 'text-amber-400' : 'text-vscode-muted')}
                    />
                    <span className={cn('min-w-0 flex-1 truncate', depth === 0 ? 'font-semibold' : 'font-mono', isSelected && 'text-vscode-focus')}>
                      {opt.label ?? opt.rel}
                    </span>
                    {isDefault ? (
                      <span
                        className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-1 py-0 text-[9px] font-bold tracking-wider text-emerald-300"
                        title="ค่าเริ่มต้นของระบบ"
                      >
                        <Codicon name="star-full" size={9} />
                        ค่าเริ่มต้น
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
