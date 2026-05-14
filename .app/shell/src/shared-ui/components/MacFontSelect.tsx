import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../utils/cn'
import { macInput } from '../macClasses'

export type MacFontSelectProps = {
  fonts: string[]
  value: string
  onChange: (family: string) => void
  disabled?: boolean
  id?: string
  placeholder?: string
  className?: string
}

export function MacFontSelect({
  fonts,
  value,
  onChange,
  disabled,
  id,
  placeholder = 'เลือกฟอนต์…',
  className,
}: MacFontSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(-1)

  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 280,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? fonts.filter((f) => f.toLowerCase().includes(q)) : fonts
  }, [fonts, query])

  const positionMenu = useCallback(() => {
    const b = btnRef.current
    if (!b) return
    const r = b.getBoundingClientRect()
    const pad = 8
    const w = Math.min(Math.max(r.width, 240), window.innerWidth - pad * 2)
    let left = r.left
    if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w
    if (left < pad) left = pad
    const maxH = 320
    let top = r.bottom + 4
    if (top + maxH > window.innerHeight - pad) top = Math.max(pad, r.top - maxH - 4)
    setMenuStyle({ top, left, width: w })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    setCursor(-1)
    setQuery('')
    const t = setTimeout(() => searchRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', positionMenu, true)
    window.addEventListener('resize', positionMenu)
    return () => {
      window.removeEventListener('scroll', positionMenu, true)
      window.removeEventListener('resize', positionMenu)
    }
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // scroll active item into view when cursor changes
  useEffect(() => {
    if (cursor < 0 || !listRef.current) return
    const el = listRef.current.children[cursor] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && cursor >= 0 && filtered[cursor]) {
      onChange(filtered[cursor])
      setOpen(false)
    }
  }

  const display = value.trim() || placeholder

  const menu =
    open && !disabled
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100000] flex flex-col rounded-sm border border-vscode-border bg-vscode-editor shadow-[0_16px_48px_rgb(0_0_0/0.55)]"
            style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, maxHeight: 'min(320px, calc(100vh - 24px))' }}
          >
            {/* search */}
            <div className="border-b border-vscode-border px-2 py-1.5">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(-1) }}
                onKeyDown={handleKeyDown}
                placeholder="ค้นหาฟอนต์…"
                className="w-full rounded-sm bg-vscode-input px-2 py-1 text-[12px] text-vscode-fg outline-none placeholder:text-vscode-muted focus:ring-1 focus:ring-vscode-focus/40"
              />
            </div>

            {/* list */}
            <div ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-vscode-muted">ไม่พบฟอนต์</div>
              ) : (
                filtered.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={name === value}
                    className={cn(
                      'flex w-full items-center px-3 py-[7px] text-left text-[12px] text-vscode-fg transition-colors hover:bg-vscode-list-hover',
                      name === value && 'bg-vscode-list-active text-vscode-fg-bright',
                      cursor === i && name !== value && 'bg-vscode-list-hover'
                    )}
                    style={{ fontFamily: name }}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => { onChange(name); setOpen(false) }}
                  >
                    {name}
                  </button>
                ))
              )}
            </div>

            {/* footer count */}
            <div className="border-t border-vscode-border px-3 py-1 text-[10px] text-vscode-muted">
              {filtered.length} ฟอนต์{query ? ` (กรอง)` : ''}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(macInput(), 'flex w-full items-center justify-between gap-2 text-left')}
      >
        <span className="min-w-0 truncate" style={{ fontFamily: value.trim() || 'system-ui' }}>
          {display}
        </span>
        <svg
          className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menu}
    </div>
  )
}
