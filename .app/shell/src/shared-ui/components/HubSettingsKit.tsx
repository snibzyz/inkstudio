/**
 * HubSettingsKit — barrel re-export ของ UI primitives สำหรับหน้า "ตั้งค่า"
 *
 * เป้าหมาย: หน้าตั้งค่าทุก tab (เวิร์กสเปซ / โปรเจกต์ / ต้นฉบับ / ตรวจ / คำศัพท์ / สำนวน / พร้อมพ์)
 * ใช้ component ชุดเดียวกัน — แก้จุดเดียวเปลี่ยนทั้งระบบ
 *
 * Style baseline: VS Code Dark+ — flat, ไร้เงา, ขอบบาง
 * Accent: gradient เบา ๆ เฉพาะ Hero header, ปุ่ม primary/success/magic, Mode toggle
 *
 * Component groups:
 *   - hubSettings/tones                 — TONE_* tokens + HubSettingsTone type
 *   - hubSettings/HubSettingsLayout     — Layout + Hero + Section (shell scaffolding)
 *   - hubSettings/HubSettingsControls   — Field + Input + CheckRow + ToggleGroup + Button + ActionRow
 *   - hubSettings/HubSettingsDisplay    — Stat + Badge + Alert + PathRow + FileRow + EmptyState
 */

export type { HubSettingsTone } from './hubSettings/tones'
export {
  TONE_BADGE,
  TONE_BG_SOFT,
  TONE_BORDER,
  TONE_ICON,
  TONE_TEXT,
} from './hubSettings/tones'

export {
  HubSettingsLayout,
  hubSettingsSectionDomId,
  type HubSettingsSectionDef,
} from './hubSettings/HubSettingsLayout'
export { HubSettingsHero } from './hubSettings/HubSettingsHero'
export { HubSettingsSection } from './hubSettings/HubSettingsSection'

export {
  HubSettingsActionRow,
  HubSettingsButton,
  HubSettingsCheckRow,
  HubSettingsField,
  HubSettingsInput,
  HubSettingsToggleGroup,
  hubSettingsInputClass,
  type HubSettingsButtonTone,
  type HubSettingsToggleOption,
} from './hubSettings/HubSettingsControls'

export {
  HubSettingsAlert,
  HubSettingsBadge,
  HubSettingsEmptyState,
  HubSettingsFilePickerHeader,
  HubSettingsFileRow,
  HubSettingsPathRow,
  HubSettingsStat,
  HubSettingsStatGrid,
} from './hubSettings/HubSettingsDisplay'

export {
  HubSettingsFolderPicker,
  type FolderPickerOption,
} from './hubSettings/HubSettingsFolderPicker'
