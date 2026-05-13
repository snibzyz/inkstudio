import { useRef, useState } from 'react'
import { AppButton, Codicon, MacFieldLabel, MacPanel } from '../../ui'
import { useStudio } from '../../state/useStudio'
import { ModuleShell, type ModuleSection } from '../shared/ModuleShell'
import { CoverCanvas } from './CoverCanvas'
import { useCoverState, type TextLayer } from './useCoverState'
import { runBatchExport, BatchExportError } from './batchExport'

type SectionId = 'overview' | 'image' | 'background' | 'title' | 'chapter' | 'export' | 'scripts'

const SECTIONS: ReadonlyArray<ModuleSection<SectionId>> = [
  { id: 'overview', label: 'ภาพรวม', icon: 'dashboard' },
  { id: 'image', label: 'ภาพปก', icon: 'device-camera', step: 1 },
  { id: 'background', label: 'พื้นหลัง · ปก', icon: 'symbol-color', step: 2 },
  { id: 'title', label: 'ชื่อเรื่อง', icon: 'symbol-string', step: 3 },
  { id: 'chapter', label: 'เลขตอน (auto)', icon: 'symbol-numeric', step: 4 },
  { id: 'export', label: 'ส่งออก batch', icon: 'export', step: 5 },
  { id: 'scripts', label: 'สคริปต์', icon: 'save' },
]

export function CoverModule() {
  const [active, setActive] = useState<SectionId>('overview')
  const job = useCoverState((s) => s.job)
  const scriptsCount = useCoverState((s) => Object.keys(s.scripts).length)

  const sections = SECTIONS.map((s) => {
    if (s.id === 'scripts' && scriptsCount > 0) return { ...s, badge: String(scriptsCount) }
    if (s.id === 'export' && job.busy)
      return { ...s, badge: `${Math.round((job.progress || 0) * 100)}%` }
    return s
  })

  return (
    <ModuleShell
      icon="symbol-color"
      title="ทำปก"
      subtitle="canvas 1280×720 · blur bg + foreground + title + เลขตอน auto"
      sections={sections}
      activeSection={active}
      onSectionChange={setActive}
      preview={<CoverPreviewPane />}
    >
      {active === 'overview' && <OverviewSection />}
      {active === 'image' && <ImageSection />}
      {active === 'background' && <BackgroundSection />}
      {active === 'title' && <TitleSection />}
      {active === 'chapter' && <ChapterSection />}
      {active === 'export' && <ExportSection />}
      {active === 'scripts' && <ScriptsSection />}
    </ModuleShell>
  )
}

function OverviewSection() {
  const baseImage = useCoverState((s) => s.baseImage)
  const batch = useCoverState((s) => s.batch)
  const title = useCoverState((s) => s.title)
  const chapter = useCoverState((s) => s.chapter)
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="info" className="mr-1.5" />
        ภาพรวม — ทำปก video (1280×720)
      </h3>
      <ol className="list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-vscode-fg-dim">
        <li>อัปโหลดภาพปกนิยายต้นแบบ (จะใช้ทั้งเป็น blurred background + foreground cover)</li>
        <li>ปรับ blur ของพื้นหลัง · ตำแหน่ง/ขนาดของปก foreground</li>
        <li>ใส่ชื่อเรื่อง (ข้อความคงที่)</li>
        <li>ตั้ง template เลขตอน เช่น <code className="rounded-sm bg-vscode-input/60 px-1">{'ตอนที่ {n}'}</code></li>
        <li>ระบุ เริ่ม-จบ-ต่อชุด-เติมศูนย์ · เลือกโฟลเดอร์ปลายทาง · กดเริ่มส่งออก</li>
      </ol>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="ภาพต้นแบบ" value={baseImage?.name ?? '— ยังไม่ได้เลือก'} icon="device-camera" />
        <StatCard label="ชื่อเรื่อง" value={title.text || '— ว่าง'} icon="symbol-string" />
        <StatCard
          label="เลขตอน"
          value={`${chapter.text} · ${batch.start}-${batch.end} (เติม ${batch.padding})`}
          icon="symbol-numeric"
        />
        <StatCard label="ปลายทาง" value={batch.outputFolder || '— ยังไม่ได้เลือก'} icon="folder-opened" />
      </div>
      <p className="text-[11px] leading-relaxed text-vscode-muted">
        หลังส่งออกเสร็จ ระบบ sync path ของโฟลเดอร์ผลลัพธ์ไปยังโมดูล{' '}
        <span className="text-vscode-fg">เรนเดอร์คลิป</span> อัตโนมัติ — กดไปแท็บคลิปแล้วจะมีปุ่ม "ใช้ปกล่าสุด"
      </p>
    </MacPanel>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-vscode-muted">
        <Codicon name={icon} />
        {label}
      </div>
      <div className="mt-1 truncate text-[12px] text-vscode-fg">{value}</div>
    </div>
  )
}

function ImageSection() {
  const baseImage = useCoverState((s) => s.baseImage)
  const setBaseImage = useCoverState((s) => s.setBaseImage)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function pickFromFs() {
    const fs = window.inkstudio?.fs
    if (!fs?.chooseFile) {
      fileInputRef.current?.click()
      return
    }
    const filePath = await fs.chooseFile({
      filters: [{ name: 'รูปภาพ', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    if (typeof filePath !== 'string' || !filePath) return
    const res = await fs.readBytes?.(filePath)
    if (!res?.ok || !res.base64) {
      // eslint-disable-next-line no-console
      console.warn('[cover] readBytes failed', res?.error)
      return
    }
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/png'
    const name = filePath.split(/[\\/]/u).pop() ?? filePath
    setBaseImage({ dataUrl: `data:${mime};base64,${res.base64}`, name })
  }

  function onBrowserFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBaseImage({ dataUrl: reader.result, name: f.name })
      }
    }
    reader.readAsDataURL(f)
  }

  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="device-camera" className="mr-1.5" />
        ภาพปกต้นแบบ
      </h3>
      <p className="text-[11px] leading-relaxed text-vscode-muted">
        อัปโหลด 1 ไฟล์ (.png / .jpg / .webp) — จะใช้เป็นทั้งพื้นหลัง (blur) และปก foreground
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onBrowserFilePicked}
      />
      <div className="flex gap-2">
        <AppButton tone="primary" variant="flat" onPress={pickFromFs}>
          <Codicon name="folder-opened" />
          เลือกภาพ...
        </AppButton>
        {baseImage ? (
          <AppButton tone="zinc" variant="flat" onPress={() => setBaseImage(null)}>
            <Codicon name="trash" />
            ลบ
          </AppButton>
        ) : null}
      </div>
      {baseImage ? (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-2 text-[11px]">
          <div className="text-vscode-fg">{baseImage.name}</div>
          <div className="text-vscode-muted">ดู preview ทางขวา</div>
        </div>
      ) : (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-3 text-[11px] text-vscode-muted">
          ถ้ายังไม่เลือกภาพ canvas จะใช้ amber gradient เป็น fallback
        </div>
      )}
    </MacPanel>
  )
}

function BackgroundSection() {
  const background = useCoverState((s) => s.background)
  const foreground = useCoverState((s) => s.foreground)
  const patchBg = useCoverState((s) => s.patchBackground)
  const patchFg = useCoverState((s) => s.patchForeground)
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="symbol-color" className="mr-1.5" />
        พื้นหลัง · ปก foreground
      </h3>

      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-vscode-muted">
        พื้นหลัง (blurred)
      </div>
      <RangeField
        label="Blur (px)"
        value={background.blur}
        min={0}
        max={40}
        onChange={(v) => patchBg({ blur: v })}
      />
      <RangeField
        label="Dim (0–100%)"
        value={Math.round(background.dim * 100)}
        min={0}
        max={100}
        onChange={(v) => patchBg({ dim: v / 100 })}
      />

      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-vscode-muted">
        ปก foreground
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => patchFg({ show: !foreground.show })}
          className={`h-8 rounded-sm border px-3 text-[12px] ${
            foreground.show
              ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
              : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
          }`}
        >
          {foreground.show ? 'แสดง' : 'ซ่อน'}
        </button>
        <span className="text-[11px] text-vscode-muted">
          ปก 2:3 ที่ไม่ blur — วางทับพื้นหลัง
        </span>
      </div>
      <RangeField
        label="ขนาด (% ของ canvas height)"
        value={Math.round(foreground.scale * 100)}
        min={20}
        max={100}
        onChange={(v) => patchFg({ scale: v / 100 })}
      />
      <div className="grid grid-cols-2 gap-2">
        <RangeField
          label="ตำแหน่ง X (%)"
          value={foreground.xPercent}
          min={0}
          max={100}
          onChange={(v) => patchFg({ xPercent: v })}
        />
        <RangeField
          label="ตำแหน่ง Y (%)"
          value={foreground.yPercent}
          min={0}
          max={100}
          onChange={(v) => patchFg({ yPercent: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RangeField
          label="มุมโค้ง (px)"
          value={foreground.cornerRadius}
          min={0}
          max={40}
          onChange={(v) => patchFg({ cornerRadius: v })}
        />
        <div>
          <MacFieldLabel>เงา</MacFieldLabel>
          <button
            type="button"
            onClick={() => patchFg({ shadow: !foreground.shadow })}
            className={`h-8 w-full rounded-sm border text-[12px] ${
              foreground.shadow
                ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
            }`}
          >
            {foreground.shadow ? 'เปิด' : 'ปิด'}
          </button>
        </div>
      </div>
    </MacPanel>
  )
}

function TitleSection() {
  const title = useCoverState((s) => s.title)
  const patchTitle = useCoverState((s) => s.patchTitle)
  return (
    <TextLayerEditor
      heading="ชื่อเรื่อง (ข้อความคงที่)"
      icon="symbol-string"
      hint="แสดงในทุกตอน — ไม่เปลี่ยน"
      placeholder="เช่น ชื่อนิยาย / ตำแหน่งนักเขียน"
      layer={title}
      patch={patchTitle}
    />
  )
}

function ChapterSection() {
  const chapter = useCoverState((s) => s.chapter)
  const patchChapter = useCoverState((s) => s.patchChapter)
  const padding = useCoverState((s) => s.batch.padding)
  const patchBatch = useCoverState((s) => s.patchBatch)
  const previewChapter = useCoverState((s) => s.previewChapter)
  const setPreviewChapter = useCoverState((s) => s.setPreviewChapter)

  return (
    <div className="flex flex-col gap-3">
      <TextLayerEditor
        heading="เลขตอน (auto)"
        icon="symbol-numeric"
        hint='ใช้ token {n} แทนเลขตอน เช่น "ตอนที่ {n}" หรือ "EP {n}"'
        placeholder="ตอนที่ {n}"
        layer={chapter}
        patch={patchChapter}
      />
      <MacPanel className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
          <Codicon name="preview" className="mr-1.5" />
          Preview ตอนปัจจุบัน
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="ทดสอบเลข"
            value={previewChapter}
            min={0}
            onChange={setPreviewChapter}
          />
          <NumberField
            label="เติมศูนย์ (padding)"
            value={padding}
            min={0}
            max={8}
            onChange={(v) => patchBatch({ padding: v })}
          />
        </div>
        <p className="text-[11px] text-vscode-muted">
          ตัวอย่าง: <code className="rounded-sm bg-vscode-input/60 px-1">
            {chapter.text.replace(/\{n\}/gu, String(previewChapter).padStart(padding, '0'))}
          </code>
        </p>
      </MacPanel>
    </div>
  )
}

function TextLayerEditor({
  heading,
  icon,
  hint,
  placeholder,
  layer,
  patch,
}: {
  heading: string
  icon: string
  hint: string
  placeholder: string
  layer: TextLayer
  patch: (p: Partial<TextLayer>) => void
}) {
  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name={icon} className="mr-1.5" />
        {heading}
      </h3>
      <p className="text-[11px] leading-relaxed text-vscode-muted">{hint}</p>
      <div>
        <MacFieldLabel>ข้อความ</MacFieldLabel>
        <input
          value={layer.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder={placeholder}
          className="h-8 w-full rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="ขนาดฟอนต์ (px)"
          value={layer.fontSize}
          min={8}
          max={200}
          onChange={(v) => patch({ fontSize: v })}
        />
        <div>
          <MacFieldLabel>สีข้อความ</MacFieldLabel>
          <input
            type="color"
            value={layer.color}
            onChange={(e) => patch({ color: e.target.value })}
            className="h-8 w-full rounded-sm border border-vscode-input-border bg-vscode-input"
            aria-label="เลือกสี"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RangeField
          label="ตำแหน่ง X (%)"
          value={layer.xPercent}
          min={0}
          max={100}
          onChange={(v) => patch({ xPercent: v })}
        />
        <RangeField
          label="ตำแหน่ง Y (%)"
          value={layer.yPercent}
          min={0}
          max={100}
          onChange={(v) => patch({ yPercent: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <MacFieldLabel>การจัด</MacFieldLabel>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patch({ align: a })}
                className={`h-8 flex-1 rounded-sm border text-[12px] ${
                  layer.align === a
                    ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                    : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
                }`}
              >
                {a === 'left' ? 'ซ้าย' : a === 'center' ? 'กลาง' : 'ขวา'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <MacFieldLabel>น้ำหนัก (weight)</MacFieldLabel>
          <select
            value={layer.weight}
            onChange={(e) => patch({ weight: Number(e.target.value) })}
            className="h-8 w-full rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
          >
            <option value={400}>ปกติ (400)</option>
            <option value={600}>หนา (600)</option>
            <option value={700}>หนามาก (700)</option>
            <option value={800}>เข้ม (800)</option>
            <option value={900}>เข้มมาก (900)</option>
          </select>
        </div>
      </div>
      <div>
        <MacFieldLabel>ขอบดำ (กันอ่านไม่ออกบนพื้นสว่าง)</MacFieldLabel>
        <button
          type="button"
          onClick={() => patch({ stroke: !layer.stroke })}
          className={`h-8 w-full rounded-sm border text-[12px] ${
            layer.stroke
              ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
              : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
          }`}
        >
          {layer.stroke ? 'เปิดขอบดำ' : 'ไม่มีขอบ'}
        </button>
      </div>
    </MacPanel>
  )
}

function ExportSection() {
  const batch = useCoverState((s) => s.batch)
  const patchBatch = useCoverState((s) => s.patchBatch)
  const baseImage = useCoverState((s) => s.baseImage)
  const background = useCoverState((s) => s.background)
  const foreground = useCoverState((s) => s.foreground)
  const title = useCoverState((s) => s.title)
  const chapter = useCoverState((s) => s.chapter)
  const job = useCoverState((s) => s.job)
  const setJob = useCoverState((s) => s.setJob)
  const resetJob = useCoverState((s) => s.resetJob)
  const setCoverOutput = useStudio((s) => s.setCoverOutput)
  const cancelRef = useRef(false)

  async function chooseOutputFolder() {
    const folder = await window.inkstudio?.fs?.chooseFolder?.()
    if (typeof folder === 'string') patchBatch({ outputFolder: folder })
  }

  async function startBatch() {
    cancelRef.current = false
    resetJob()
    setJob({ busy: true, message: 'กำลังเริ่ม...', progress: 0, current: 0, total: 0, error: null })
    try {
      const result = await runBatchExport(
        {
          baseImageDataUrl: baseImage?.dataUrl ?? null,
          background,
          foreground,
          title,
          chapter,
          batch,
        },
        (p) =>
          setJob({
            current: p.current + 1,
            total: p.total,
            progress: p.total > 0 ? (p.current + 1) / p.total : 0,
            message: `ตอนที่ ${p.chapter} → ${p.fileName}`,
          }),
        () => cancelRef.current,
      )
      setJob({
        busy: false,
        message: `เสร็จ: ${result.successCount}/${result.totalFiles} ไฟล์${
          result.failedFiles.length > 0 ? ` · ล้มเหลว ${result.failedFiles.length}` : ''
        }`,
        progress: 1,
      })
      setCoverOutput({ kind: 'folder', folderPath: batch.outputFolder, updatedAt: Date.now() })
    } catch (err) {
      const msg =
        err instanceof BatchExportError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      setJob({ busy: false, error: msg, message: 'หยุดการทำงาน' })
    }
  }

  function cancelBatch() {
    cancelRef.current = true
  }

  async function previewOne() {
    cancelRef.current = false
    resetJob()
    setJob({ busy: true, message: 'ส่งออก 1 ภาพทดสอบ...', progress: 0 })
    try {
      const oneShot = { ...batch, end: batch.start, step: 1 }
      const result = await runBatchExport(
        {
          baseImageDataUrl: baseImage?.dataUrl ?? null,
          background,
          foreground,
          title,
          chapter,
          batch: oneShot,
        },
        () => undefined,
        () => cancelRef.current,
      )
      setJob({
        busy: false,
        message:
          result.successCount > 0
            ? `ทดสอบ ${result.successCount} ภาพในโฟลเดอร์ปลายทาง`
            : `ล้มเหลว — ${result.failedFiles.join(', ')}`,
        progress: 1,
      })
    } catch (err) {
      const msg =
        err instanceof BatchExportError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err)
      setJob({ busy: false, error: msg, message: 'หยุดการทำงาน' })
    }
  }

  function revealOutput() {
    if (!batch.outputFolder) return
    void window.inkstudio?.fs?.revealFolder?.(batch.outputFolder)
  }

  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="export" className="mr-1.5" />
        ส่งออก batch
      </h3>
      <div>
        <MacFieldLabel>โฟลเดอร์ปลายทาง</MacFieldLabel>
        <div className="flex gap-1">
          <input
            value={batch.outputFolder}
            onChange={(e) => patchBatch({ outputFolder: e.target.value })}
            placeholder="เลือกโฟลเดอร์..."
            className="h-8 flex-1 rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
          />
          <button
            type="button"
            title="เลือกโฟลเดอร์"
            onClick={chooseOutputFolder}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-vscode-border bg-vscode-button text-vscode-fg hover:bg-vscode-button-hover"
          >
            <Codicon name="folder-opened" />
          </button>
          <button
            type="button"
            title="เปิดในไฟล์เอกซ์พลอเรอร์"
            onClick={revealOutput}
            disabled={!batch.outputFolder}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-vscode-border bg-vscode-button text-vscode-fg hover:bg-vscode-button-hover disabled:opacity-45"
          >
            <Codicon name="link-external" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <NumberField label="เริ่ม" value={batch.start} min={0} onChange={(v) => patchBatch({ start: v })} />
        <NumberField label="จบ" value={batch.end} min={0} onChange={(v) => patchBatch({ end: v })} />
        <NumberField label="ต่อชุด" value={batch.step} min={1} onChange={(v) => patchBatch({ step: v })} />
        <NumberField
          label="เติมศูนย์"
          value={batch.padding}
          min={0}
          max={8}
          onChange={(v) => patchBatch({ padding: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <MacFieldLabel>รูปแบบไฟล์</MacFieldLabel>
          <div className="flex gap-1">
            {(['png', 'jpg'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => patchBatch({ format: f })}
                className={`h-8 flex-1 rounded-sm border text-[12px] font-medium uppercase ${
                  batch.format === f
                    ? 'border-vscode-brand bg-vscode-brand/15 text-vscode-fg-bright'
                    : 'border-vscode-border bg-transparent text-vscode-fg-dim hover:bg-vscode-list-hover'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <NumberField
          label="คุณภาพ (jpg)"
          value={batch.quality}
          min={1}
          max={100}
          onChange={(v) => patchBatch({ quality: v })}
        />
      </div>

      {job.error ? (
        <div
          role="alert"
          className="rounded-sm border border-vscode-error/40 bg-vscode-error-bg/40 p-2 text-[11px] text-vscode-error"
        >
          {job.error}
        </div>
      ) : null}

      {job.busy || job.progress > 0 || job.message ? (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-2 text-[11px] text-vscode-fg-dim">
          <div className="flex items-center justify-between">
            <span className="truncate">{job.message || 'พร้อมทำงาน'}</span>
            {job.total > 0 ? (
              <span className="tabular-nums text-vscode-muted">
                {job.current}/{job.total}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-vscode-input">
            <div
              className="h-full bg-vscode-brand transition-[width] duration-200"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <AppButton tone="zinc" variant="flat" disabled={job.busy} onPress={() => void previewOne()}>
          <Codicon name="preview" />
          ทดสอบ 1 ภาพ
        </AppButton>
        {job.busy ? (
          <AppButton tone="zinc" variant="flat" onPress={cancelBatch}>
            <Codicon name="stop-circle" />
            ยกเลิก
          </AppButton>
        ) : (
          <AppButton tone="primary" onPress={() => void startBatch()}>
            <Codicon name="play" />
            เริ่มส่งออก
          </AppButton>
        )}
      </div>
    </MacPanel>
  )
}

function ScriptsSection() {
  const scripts = useCoverState((s) => s.scripts)
  const selectedScript = useCoverState((s) => s.selectedScript)
  const setSelected = useCoverState((s) => s.setSelectedScript)
  const saveScript = useCoverState((s) => s.saveScript)
  const loadScript = useCoverState((s) => s.loadScript)
  const deleteScript = useCoverState((s) => s.deleteScript)
  const [newName, setNewName] = useState('')
  const names = Object.keys(scripts).sort()

  return (
    <MacPanel className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-vscode-fg-bright">
        <Codicon name="save" className="mr-1.5" />
        สคริปต์ที่บันทึก
      </h3>
      <p className="text-[11px] leading-relaxed text-vscode-muted">
        script เก็บค่า bg + fg + title + chapter + batch (ทุกอย่างยกเว้นภาพต้นแบบ + โฟลเดอร์ปลายทาง)
        — เก็บใน localStorage
      </p>
      <div>
        <MacFieldLabel>บันทึกเป็น</MacFieldLabel>
        <div className="flex gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อสคริปต์..."
            className="h-8 flex-1 rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
          />
          <AppButton
            tone="primary"
            variant="flat"
            disabled={!newName.trim()}
            onPress={() => {
              saveScript(newName)
              setNewName('')
            }}
          >
            <Codicon name="save" />
            บันทึก
          </AppButton>
        </div>
      </div>
      {names.length === 0 ? (
        <div className="rounded-sm border border-vscode-border bg-vscode-input/30 p-3 text-[11px] text-vscode-muted">
          ยังไม่มีสคริปต์ — ตั้งชื่อแล้วกด "บันทึก"
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {names.map((n) => (
            <li
              key={n}
              className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 text-[12px] ${
                selectedScript === n
                  ? 'border-vscode-brand/40 bg-vscode-brand/10 text-vscode-fg-bright'
                  : 'border-vscode-border bg-transparent text-vscode-fg'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelected(n)}
                className="flex-1 truncate text-left"
                title={scripts[n].hint ?? n}
              >
                {n}
                {scripts[n].hint ? (
                  <span className="ml-2 text-[10px] text-vscode-muted">{scripts[n].hint}</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => loadScript(n)}
                className="rounded-sm border border-vscode-border bg-vscode-button px-2 py-0.5 text-[11px] hover:bg-vscode-button-hover"
              >
                โหลด
              </button>
              <button
                type="button"
                onClick={() => deleteScript(n)}
                className="rounded-sm border border-vscode-error/40 bg-transparent px-2 py-0.5 text-[11px] text-vscode-error hover:bg-vscode-error/10"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      )}
    </MacPanel>
  )
}

function CoverPreviewPane() {
  const previewChapter = useCoverState((s) => s.previewChapter)
  const setPreviewChapter = useCoverState((s) => s.setPreviewChapter)
  const batch = useCoverState((s) => s.batch)
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-vscode-muted">
        <span>ตัวอย่าง 1280×720</span>
        <span className="tabular-nums">ตอน {previewChapter}</span>
      </div>
      <CoverCanvas />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewChapter(Math.max(0, previewChapter - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-vscode-border bg-vscode-button hover:bg-vscode-button-hover"
          aria-label="ตอนก่อน"
        >
          <Codicon name="chevron-left" />
        </button>
        <input
          type="range"
          min={Math.min(batch.start, 1)}
          max={Math.max(batch.end, batch.start + 1)}
          value={previewChapter}
          onChange={(e) => setPreviewChapter(Number(e.target.value))}
          className="h-8 flex-1 accent-vscode-brand"
          aria-label="เลขตอน preview"
        />
        <button
          type="button"
          onClick={() => setPreviewChapter(previewChapter + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-vscode-border bg-vscode-button hover:bg-vscode-button-hover"
          aria-label="ตอนถัดไป"
        >
          <Codicon name="chevron-right" />
        </button>
      </div>
      <div className="text-[11px] leading-relaxed text-vscode-muted">
        canvas เป็น 1280×720 (frame ของ video render) — เปลี่ยน config ทุกอย่างจะ re-render ทันที
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <label className="block">
      <MacFieldLabel>{label}</MacFieldLabel>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full rounded-sm border border-vscode-input-border bg-vscode-input px-2 text-[12px] text-vscode-fg focus:border-vscode-brand focus:outline-none"
      />
    </label>
  )
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-vscode-fg-dim">
        <span>{label}</span>
        <span className="tabular-nums text-vscode-muted">{value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-vscode-brand"
      />
    </div>
  )
}
