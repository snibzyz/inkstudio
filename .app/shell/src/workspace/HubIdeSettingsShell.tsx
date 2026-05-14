/**
 * HubIdeSettingsShell — facade ครอบ HubSettingsLayout + HubSettingsHero + HubSettingsSection
 *
 * รักษา API เดิมไว้ทั้งหมดเพื่อ backward compatibility — แต่หน้าใหม่ควรใช้
 * HubSettingsLayout + HubSettingsHero + HubSettingsSection จาก @shared/ui โดยตรง
 * เพื่อความยืดหยุ่นเต็มตัว (ใส่ description ต่อ section, action header, ฯลฯ).
 *
 * เพิ่มเสริม (optional, backward compatible):
 *   - heroIcon / heroSubtitle / heroMeta: เสริม hero header
 *   - sections[].icon: icon ในแถบนำทางและ header ของ section card
 *   - sections[].badge: badge ตัวเลขในแถบนำทางซ้าย
 *   - sections[].step: ตัวเลขขั้นตอน — แสดงใน section header
 *   - sections[].tone: สีกรอบ section
 *   - sections[].action: ปุ่ม/control ทางขวา header
 *   - sections[].description: คำอธิบายใต้ header
 *   - sections[].card = false ปิดการครอบ card (เนื้อหาจะ render แบบ flat)
 */

import type { ReactNode } from 'react'
import {
  HubSettingsLayout,
  HubSettingsHero,
  HubSettingsSection,
  hubSettingsSectionDomId,
  type HubSettingsSectionDef,
  type HubSettingsTone,
} from '@shared/ui'

export type HubIdeSettingsSection = {
  id: string
  label: string
  /** native tooltip บน h2 (hover หัวข้อ) */
  headingTitle?: string
  content: ReactNode
  /** icon นำหน้า label ทั้งใน sidebar และ section header */
  icon?: ReactNode
  /** badge ในแถบนำทาง — เช่น จำนวนรายการ */
  badge?: ReactNode
  /** สีของ badge — info (ฟ้า) / warning (ส้ม) / success (เขียว) / danger (แดง) / neutral (เทา) */
  badgeTone?: 'info' | 'warning' | 'success' | 'danger' | 'neutral'
  /** ตัวเลขขั้นตอน */
  step?: ReactNode
  /** tone สีของ section card */
  tone?: HubSettingsTone
  /** action ทางขวา header (เช่น ปุ่ม refresh) */
  action?: ReactNode
  /** คำอธิบายใต้ header */
  description?: ReactNode
  /** false = ไม่ครอบ card — เนื้อหา render แบบ flat (ไม่มี border/header) */
  card?: boolean
}

export function hubIdeSettingsSectionDomId(sectionId: string): string {
  return hubSettingsSectionDomId(sectionId)
}

export function HubIdeSettingsShell({
  navLabel,
  title,
  titleTooltip,
  description,
  sections,
  activeSectionId,
  onActiveSectionChange,
  showNav = true,
  heroIcon,
  heroSubtitle,
  heroMeta,
  navFooter,
}: {
  navLabel: string
  title: string
  titleTooltip?: string
  description?: ReactNode
  sections: HubIdeSettingsSection[]
  activeSectionId?: string
  onActiveSectionChange?: (id: string) => void
  showNav?: boolean
  /** ไอคอนนำใน hero — ขนาดแนะนำ 18px (h-4.5 w-4.5) */
  heroIcon?: ReactNode
  /** subtitle เล็ก ๆ ใต้ title */
  heroSubtitle?: string
  /** meta ทางขวาของ hero — เช่น path, badge */
  heroMeta?: ReactNode
  /** สล็อตด้านล่างของแถบ nav — ใส่ quick action ได้ */
  navFooter?: ReactNode
}) {
  const layoutSections: HubSettingsSectionDef[] = sections.map((s) => {
    const wrapped =
      s.card === false ? (
        s.content
      ) : (
        <HubSettingsSection
          icon={s.icon}
          title={s.label}
          step={s.step}
          tone={s.tone ?? 'neutral'}
          description={s.description}
          action={s.action}
        >
          {s.content}
        </HubSettingsSection>
      )
    return {
      id: s.id,
      label: s.label,
      headingTitle: s.headingTitle,
      icon: s.icon,
      badge: s.badge,
      badgeTone: s.badgeTone,
      content: wrapped,
    }
  })

  return (
    <HubSettingsLayout
      navLabel={navLabel}
      hero={
        <HubSettingsHero
          icon={heroIcon}
          title={title}
          titleTooltip={titleTooltip}
          subtitle={heroSubtitle}
          description={description}
          meta={heroMeta}
        />
      }
      sections={layoutSections}
      activeSectionId={activeSectionId}
      onActiveSectionChange={onActiveSectionChange}
      showNav={showNav}
      navFooter={navFooter}
    />
  )
}
