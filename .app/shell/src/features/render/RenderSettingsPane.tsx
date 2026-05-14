/**
 * RenderSettingsPane — เนื้อหาของแท็บตรึง "ตั้งค่าคลิป"
 *
 * INKSTUDIO ตัด section encoding + presets ออก — profile fix ที่
 * 144p · 1 fps · CRF 51 · Software H.264 · preset ultrafast
 * (เร็วสุด ทรัพยากรน้อยสุด — UI ไม่ต้องให้ user เลือก)
 */

import { useState } from 'react'
import { Codicon, HubSettingsBadge } from '@shared/ui'
import { HubIdeSettingsShell } from '@/workspace/HubIdeSettingsShell'
import { useRender } from './useRender'
import type { useRenderJob } from './useRenderJob'
import { BUG_REPORT_MAILTO, FIXED_PROFILE_INFO } from './renderConstants'
import { RenderOverviewSection } from './sections/RenderOverviewSection'
import { RenderSourceSection } from './sections/RenderSourceSection'
import { RenderFilesSection } from './sections/RenderFilesSection'
import { RenderProgressSection } from './sections/RenderProgressSection'
import { RenderQuickActions } from './sections/RenderQuickActions'

type JobBridge = ReturnType<typeof useRenderJob>

const PINNED_LABEL = 'ตั้งค่าคลิป'

type SectionId = 'overview' | 'source' | 'files' | 'progress'

export function RenderSettingsPane({ job }: { job: JobBridge }) {
  const audioFiles = useRender((s) => s.audioFiles)
  const selectedAudioFiles = useRender((s) => s.selectedAudioFiles)
  const busy = useRender((s) => s.busy)
  const error = useRender((s) => s.error)

  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const total = audioFiles.length
  const selected = selectedAudioFiles.size
  const filesBadge = total === 0 ? undefined : `${selected}/${total}`

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
      titleTooltip={`เรนเดอร์คลิปจากภาพปก + เสียง · ${FIXED_PROFILE_INFO}`}
      heroIcon={<Codicon name="device-camera-video" size={18} />}
      heroSubtitle={FIXED_PROFILE_INFO}
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
          label: 'แหล่งข้อมูล',
          icon: <Codicon name="folder-opened" />,
          step: 1,
          content: <RenderSourceSection job={job} />,
        },
        {
          id: 'files',
          label: 'ไฟล์เสียง',
          icon: <Codicon name="music" />,
          step: 2,
          badge: filesBadge,
          badgeTone: selected > 0 ? 'info' : 'neutral',
          content: <RenderFilesSection job={job} />,
        },
        {
          id: 'progress',
          label: 'เรนเดอร์',
          icon: <Codicon name={busy ? 'loading' : 'play-circle'} />,
          step: 3,
          tone: busy ? 'info' : error ? 'danger' : 'success',
          content: <RenderProgressSection job={job} />,
        },
      ]}
    />
  )
}
