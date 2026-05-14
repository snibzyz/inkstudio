/**
 * HubSettingsLayout — shell หลักของหน้าตั้งค่า (sidebar nav + main scroll area)
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../utils/cn'

const PULSE_DURATION_MS = 3000
const SCROLL_OFFSET_PX = 12

export type HubSettingsSectionDef = {
  id: string
  /** label สั้น — แสดงในแถบนำทาง */
  label: string
  /** icon สั้น — แสดงนำหน้า label */
  icon?: ReactNode
  /** badge ตัวเลข/ป้ายกำกับด้านขวาในแถบนำทาง (เช่น จำนวนรายการ) */
  badge?: ReactNode
  /** สีของ badge — แยกตามความหมาย (info/warning/success/danger/neutral) */
  badgeTone?: 'info' | 'warning' | 'success' | 'danger' | 'neutral'
  /** native tooltip บน h2 (hover หัวข้อ) — ถ้าไม่ส่ง ใช้ label */
  headingTitle?: string
  content: ReactNode
}

export function hubSettingsSectionDomId(sectionId: string): string {
  return `inkidea-settings-section-${sectionId}`
}

export function HubSettingsLayout({
  navLabel,
  hero,
  sections,
  activeSectionId,
  onActiveSectionChange,
  showNav = true,
  navWidth = 'normal',
  navFooter,
}: {
  navLabel: string
  hero: ReactNode
  sections: HubSettingsSectionDef[]
  activeSectionId?: string
  onActiveSectionChange?: (id: string) => void
  showNav?: boolean
  navWidth?: 'narrow' | 'normal' | 'wide'
  /** สล็อตด้านล่าง nav — ใส่ปุ่ม quick action ได้ */
  navFooter?: ReactNode
}) {
  const firstId = sections[0]?.id ?? ''
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  /** id ของ section ที่ผู้ใช้กระโดดมาล่าสุด — ใช้ trigger pulse ring */
  const [pulseId, setPulseId] = useState<string | null>(null)
  const pulseTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current)
    }
  }, [])

  /**
   * เลื่อนเฉพาะคอนเทนเนอร์ภายใน — ไม่ใช้ scrollIntoView เพื่อไม่ให้ scroll
   * ไหลออกไปยัง ancestor (ทำให้ menubar ที่อยู่บนสุดของแอปไม่ถูกเลื่อนหายไป)
   */
  const scrollToSection = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      const target = container?.querySelector<HTMLElement>(`#${CSS.escape(hubSettingsSectionDomId(id))}`)
      if (!container || !target) return
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const offset = targetRect.top - containerRect.top + container.scrollTop - SCROLL_OFFSET_PX
      container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
    })
  }, [])

  /** trigger pulse ring 3 วินาทีเพื่อชี้ตำแหน่งให้ผู้ใช้ */
  const triggerPulse = useCallback((id: string) => {
    setPulseId(id)
    if (pulseTimeoutRef.current !== null) window.clearTimeout(pulseTimeoutRef.current)
    pulseTimeoutRef.current = window.setTimeout(() => {
      setPulseId((cur) => (cur === id ? null : cur))
      pulseTimeoutRef.current = null
    }, PULSE_DURATION_MS)
  }, [])

  const onPickSection = useCallback(
    (id: string) => {
      onActiveSectionChange?.(id)
      scrollToSection(id)
      triggerPulse(id)
    },
    [onActiveSectionChange, scrollToSection, triggerPulse]
  )

  const effectiveActive = showNav ? (activeSectionId ?? firstId) : firstId

  const navWidthClass =
    navWidth === 'narrow'
      ? 'w-[min(38vw,180px)]'
      : navWidth === 'wide'
        ? 'w-[min(46vw,260px)]'
        : 'w-[min(42vw,220px)]'

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-vscode-editor text-vscode-fg">
      {showNav ? (
        <nav
          className={cn(
            navWidthClass,
            'shrink-0 flex flex-col border-r border-vscode-border bg-vscode-sidebar/90 py-2'
          )}
          aria-label={navLabel}
        >
          <ul className="space-y-0.5 px-1">
            {sections.map((s) => (
              <li key={s.id}>
                <NavItemButton
                  section={s}
                  active={effectiveActive === s.id}
                  onPick={onPickSection}
                />
              </li>
            ))}
          </ul>
          {navFooter ? (
            <div className="mt-auto border-t border-vscode-border/60 px-2 pt-2">{navFooter}</div>
          ) : null}
        </nav>
      ) : null}
      <div ref={scrollContainerRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        <div className="mx-auto max-w-[920px] px-5 py-5">
          {hero}
          <div className="mt-5 space-y-5">
            {sections.map((s) => {
              const h2Title = s.headingTitle ?? s.label
              const headingId = `${hubSettingsSectionDomId(s.id)}-heading`
              const pulsing = pulseId === s.id
              return (
                <section
                  key={s.id}
                  id={hubSettingsSectionDomId(s.id)}
                  aria-labelledby={headingId}
                  className={cn(
                    'rounded-sm border border-transparent transition-colors',
                    pulsing ? 'animate-ink-pulse' : ''
                  )}
                >
                  <div className="sr-only" id={headingId}>{h2Title}</div>
                  {s.content}
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItemButton({
  section,
  active,
  onPick,
}: {
  section: HubSettingsSectionDef
  active: boolean
  onPick: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(section.id)}
      title={section.headingTitle ?? section.label}
      className={cn(
        'group flex w-full min-h-8 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
        active
          ? 'bg-vscode-list-active text-vscode-fg-bright'
          : 'text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
      )}
    >
      {section.icon ? (
        <span
          className={cn(
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-colors',
            active ? 'text-vscode-focus' : 'text-vscode-muted group-hover:text-vscode-fg'
          )}
          aria-hidden
        >
          {section.icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{section.label}</span>
      {section.badge !== undefined && section.badge !== null ? (
        <NavItemBadge active={active} tone={section.badgeTone}>{section.badge}</NavItemBadge>
      ) : null}
    </button>
  )
}

function NavItemBadge({
  active,
  tone,
  children,
}: {
  active: boolean
  tone?: 'info' | 'warning' | 'success' | 'danger' | 'neutral'
  children: ReactNode
}) {
  const toneClass = (() => {
    if (active) return 'bg-vscode-focus/25 text-vscode-fg-bright'
    switch (tone) {
      case 'info':    return 'bg-sky-500/15 text-sky-300 group-hover:bg-sky-500/25'
      case 'warning': return 'bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25'
      case 'success': return 'bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500/25'
      case 'danger':  return 'bg-rose-500/15 text-rose-300 group-hover:bg-rose-500/25'
      case 'neutral':
      default:        return 'bg-vscode-input/50 text-vscode-muted group-hover:bg-vscode-input/70'
    }
  })()
  return (
    <span className={cn('shrink-0 rounded-sm px-1.5 py-px text-[10px] font-semibold tabular-nums', toneClass)}>
      {children}
    </span>
  )
}
