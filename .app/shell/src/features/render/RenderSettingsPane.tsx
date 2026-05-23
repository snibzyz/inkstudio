/**
 * RenderSettingsPane — เนื้อหาของแท็บตรึง "ตั้งค่าคลิป"
 * ใช้ HubIdeSettingsShell เหมือนแท็บอื่น (เสียง / ตรวจ)
 */

import { useState } from 'react'
import { Codicon, HubSettingsBadge } from '@shared/ui'
import { HubIdeSettingsShell } from '@/workspace/HubIdeSettingsShell'
import { useRender } from './useRender'
import type { useRenderJob } from './useRenderJob'
import { BUG_REPORT_MAILTO } from './renderConstants'
import { RenderOverviewSection } from './sections/RenderOverviewSection'
import { RenderSourceSection } from './sections/RenderSourceSection'
import { RenderEncodingSection } from './sections/RenderEncodingSection'
import { RenderPresetsSection } from './sections/RenderPresetsSection'
import { RenderFilesSection } from './sections/RenderFilesSection'
import { RenderProgressSection } from './sections/RenderProgressSection'
import { RenderQuickActions } from './sections/RenderQuickActions'

type JobBridge = ReturnType<typeof useRenderJob>

const PINNED_LABEL = 'ตั้งค่าคลิป'

type SectionId = 'overview' | 'source' | 'encoding' | 'presets' | 'files' | 'progress'

export function RenderSettingsPane({ job }: { job: JobBridge }) {
  const audioFiles = useRender((s) => s.audioFiles)
  const selectedAudioFiles = useRender((s) => s.selectedAudioFiles)
  const busy = useRender((s) => s.busy)
  const error = useRender((s) => s.error)

  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const total = audioFiles.length
  const selected = selectedAudioFiles.size
  const filesBadge = total === 0 ? undefined : `${selected}/${total}`
  const heroSubtitle = 'นิยายเสียง · ภาพนิ่ง + เสียง'

  const heroMeta = (
    <div className="flex items-center gap-2">
      <HubSettingsBadge tone="success" icon={<Codicon name="zap" />}>
        FFmpeg ในตัวแอป
      </HubSettingsBadge>
      <a
        href={BUG_REPORT_MAILTO}
        className="inline-flex items-center gap-1 rounded-sm border border-vscode-border bg-vscode-input/30 px-2 py-0.5 text-[11px] text-vscode-fg-dim transition-colors hover:bg-vscode-list-hover hover:text-vscode-fg"
        title="รายงานบั๊กผ่านอีเมล"
      >
        <Codicon name="bug" /> พบบั๊ก
      </a>
    </div>
  )

  return (
    <HubIdeSettingsShell
      navLabel={PINNED_LABEL}
      navFooter={<RenderQuickActions job={job} />}
      title={PINNED_LABEL}
      titleTooltip="สร้างวิดีโอจากภาพปก + เสียง — เลือกไฟล์ ตั้งคุณภาพ แล้วกดเริ่มทำคลิป"
      heroIcon={<Codicon name="device-camera-video" size={18} />}
      heroSubtitle={heroSubtitle}
      heroMeta={heroMeta}
      activeSectionId={activeSection}
      onActiveSectionChange={(id) => setActiveSection(id as SectionId)}
      sections={[
        {
          id: 'overview',
          label: 'ภาพรวม',
          icon: <Codicon name="dashboard" />,
          content: <RenderOverviewSection />,
        },
        {
          id: 'source',
          label: 'ไฟล์ที่ใช้',
          icon: <Codicon name="folder-opened" />,
          step: 1,
          content: <RenderSourceSection job={job} />,
        },
        {
          id: 'encoding',
          label: 'คุณภาพวิดีโอ',
          icon: <Codicon name="settings-gear" />,
          step: 2,
          content: <RenderEncodingSection />,
        },
        {
          id: 'presets',
          label: 'ค่าที่จำไว้',
          icon: <Codicon name="bookmark" />,
          step: 3,
          content: <RenderPresetsSection job={job} />,
        },
        {
          id: 'files',
          label: 'เลือกตอนที่จะทำ',
          icon: <Codicon name="music" />,
          step: 4,
          badge: filesBadge,
          badgeTone: selected > 0 ? 'info' : 'neutral',
          content: <RenderFilesSection job={job} />,
        },
        {
          id: 'progress',
          label: 'เริ่มทำคลิป',
          icon: <Codicon name={busy ? 'loading' : 'play-circle'} />,
          step: 5,
          tone: busy ? 'info' : error ? 'danger' : 'success',
          content: <RenderProgressSection job={job} />,
        },
      ]}
    />
  )
}
