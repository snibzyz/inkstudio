import { AppButton, HubSettingsCheckRow, MacFontSelect } from '@shared/ui'
import { LayoutTemplate, Type } from 'lucide-react'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { FieldLabel, InspectorSection, SubGroup } from './InspectorSection'

export function TemplateSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const {
    busy,
    templateApplyDefaults, setTemplateApplyDefaults,
    templateCreditVisible, setTemplateCreditVisible,
    templateFontChoice, setTemplateFontChoice,
    setTextFontFamily,
    fontChoices,
    setTemplateMode,
    ensureTemplateTextObjects,
    snapTemplateTitleAndEpisodeLayout,
    clearTemplateObjects,
  } = useCoverEditorCtx()

  return (
    <InspectorSection
      id="sect-template"
      title="เทมเพลตปก"
      icon={<LayoutTemplate className="h-3 w-3" aria-hidden />}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <SubGroup>
          <div>
            <FieldLabel>
              <span className="inline-flex items-center gap-1.5">
                <Type className="h-3 w-3 opacity-70" aria-hidden />
                ฟอนต์
              </span>
            </FieldLabel>
            <MacFontSelect fonts={fontChoices} value={templateFontChoice}
              onChange={(name) => { setTemplateFontChoice(name); setTextFontFamily(name) }} disabled={busy} />
          </div>
        </SubGroup>

        <SubGroup title="ตัวเลือก">
          <HubSettingsCheckRow
            label="เบลออัตโนมัติ"
            hint="ใช้ค่าเบลอเริ่มต้นกับพื้นหลังเมื่ออัปโหลดปก"
            checked={templateApplyDefaults}
            onChange={setTemplateApplyDefaults}
            disabled={busy}
          />
          <HubSettingsCheckRow
            label="แสดงเครดิต"
            checked={templateCreditVisible}
            onChange={setTemplateCreditVisible}
            disabled={busy}
          />
        </SubGroup>

        <SubGroup title="เทมเพลตข้อความ">
          <div className="grid grid-cols-2 gap-1.5">
            <AppButton tone="zinc" variant="flat" disabled={busy}
              onPress={() => { setTemplateMode(true); ensureTemplateTextObjects(); snapTemplateTitleAndEpisodeLayout() }}
              className="min-h-8 justify-center text-[11px]">
              สร้างข้อความ
            </AppButton>
            <AppButton tone="zinc" variant="flat" disabled={busy} onPress={clearTemplateObjects}
              className="min-h-8 justify-center text-[11px]">
              ล้างเทมเพลต
            </AppButton>
          </div>
        </SubGroup>
      </div>
    </InspectorSection>
  )
}
