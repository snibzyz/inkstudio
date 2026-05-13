# `features/cover/` — โมดูลทำปก

> สถานะ: **skeleton เท่านั้น** — `index.tsx` แสดง UI placeholder + form ส่งออก batch แบบ static

## Product goal

ทำปกตอนนิยายแบบ batch — โหลดเทมเพลตปก, เปลี่ยนเลขตอนอัตโนมัติตามช่วงที่ระบุ (เริ่ม-จบ-ต่อชุด-เติมศูนย์), บันทึก/โหลด "script" (preset ของ layer + ตำแหน่งข้อความ + ฟอนต์), ส่งออกเป็น .png หรือ .jpg

## ที่มา

Port จาก **INKIDEA `.app/shell/src/workspace/cover/`** (23 ไฟล์, ~5,500 บรรทัด)

```
INKIDEA cover/
├── CoverEditor.tsx              336 บรรทัด — main + tab wrapper (ตัด workspace tab ทิ้ง)
├── CoverCanvas.tsx              198 — fabric/canvas surface
├── CoverInspectorPanel.tsx      116 — แผง right
├── CoverExportBar.tsx           287 — bottom bar + batch dialog (ของหลัก)
├── CoverCropDialog.tsx          345 — crop modal
├── CoverImagePreviewTab.tsx     304 — preview tab (อาจไม่ต้องใน INKSTUDIO)
├── CoverEditorContext.tsx       160 — React context
├── coverEditorTypes.ts          145
├── coverEditorUtils.ts          443
├── setupCoverCanvas.ts          300
├── useCoverEditor.ts            860 — hook หลัก
├── useCoverEditorBgTemplate.ts  447
├── useCoverEditorExport.ts      212
├── useCoverLayerAdjustments.ts   64
├── useCoverSmartGuides.ts       161
└── inspector/                    7 ไฟล์ — sections ของแผงขวา
    ├── InspectorSection.tsx     157
    ├── TemplateSection.tsx       74
    ├── BackgroundSection.tsx    141
    ├── PropertiesSection.tsx    243
    ├── TransformSection.tsx     113
    ├── AdjustmentsSection.tsx   169
    ├── LayersSection.tsx        170
    └── UploadDock.tsx            98
```

## แผนการ port

### ขั้น 1 — ดึง core ไฟล์ (ไม่ผูก workspace)

Copy ไฟล์ทุกไฟล์ใน INKIDEA `cover/` → `INKSTUDIO/.app/shell/src/features/cover/` **ยกเว้น**:

- `CoverImagePreviewTab.tsx` — สำหรับเปิด image จาก explorer ของ INKIDEA, INKSTUDIO ไม่ต้องการ
- `CoverEditor.tsx` — รื้อทิ้ง เพราะผูกกับ `useHubWorkspace` + tab system. เขียนใหม่ใน `index.tsx`

### ขั้น 2 — แก้ import

1. `@shared/ui` → `../../ui` (workspace มี 8 primitive เท่านั้น — บาง primitive ของ INKIDEA เช่น `HubIdeBreadcrumbBar`, `IdeDialog`, `hubSettingsInputClass` ต้องเขียน inline หรือใช้ `MacPanel` แทน)
2. `@/state/useHubWorkspace` → ลบทิ้ง / แทนด้วย local store (`features/cover/useCoverStore.ts`)
3. `lucide-react` → ถ้ายังต้องการ icon, เพิ่ม dep หรือใช้ `<Codicon name="..." />`
4. `'.inkidea/pinned/cover-settings'` constant — ลบทิ้ง ไม่ต้องตรึง tab

### ขั้น 3 — แก้ workspace coupling

- `useHubWorkspace` มี: `activeProjectId`, `workspaceOpenFilePath`, `requestWorkspaceFileOpen`, `requestExplorerReveal`, `readWorkspaceFileAsDataUrl`, `setEditorTabCloseForMode`, `setEditorTabCycleForMode`, `hubWorkspaceActiveMode`
- INKSTUDIO ไม่มี workspace — ใช้ electron file picker (`window.inkstudio.fs.*`) แทน
- ตัด multi-tab editor (pinned + ภาพหลายแท็บ) ออก → คงไว้แค่ canvas + inspector + export bar เดียว

### ขั้น 4 — auto-numbering (killer feature)

โค้ดอยู่ใน `useCoverEditorExport.ts` (212 บรรทัด) + UI ใน `CoverExportBar.tsx` (287 บรรทัด → `exportBatch()`)

หลักการ: ระบุ `batchStart, batchEnd, batchLength, batchPadding` → loop เรียก export ซ้ำ พร้อม inject เลขตอนใน text layer ที่ user mark ไว้

### ขั้น 5 — save/load script

ปัจจุบัน INKIDEA save script ลงใน `.inkidea/pinned/cover-settings` (path ใน workspace) — เปลี่ยนเป็น save lง `userData/cover-scripts/<name>.json` ผ่าน IPC ใหม่:

```
cover:save-script  { name, data }    → ok
cover:load-script  { name }          → data | null
cover:list-scripts ()                → [name, ...]
cover:delete-script { name }         → ok
```

## IPC ที่ต้องเพิ่มใน main process

- `dialog:select-files`     — มีอยู่แล้วใน `electron/ipc/dialog.cjs` (.shared)
- `cover:save-script`       — เขียนใหม่
- `cover:load-script`       — เขียนใหม่
- `cover:list-scripts`      — เขียนใหม่
- `cover:delete-script`     — เขียนใหม่

## Deps ที่อาจต้องเพิ่มใน `package.json`

ตรวจ `useCoverEditor.ts` / `setupCoverCanvas.ts` ก่อน port — มักจะมี:

- `fabric` หรือ canvas API ตรง ๆ (ตรวจดูใน setupCoverCanvas)
- `lucide-react` (ถ้ายังใช้ icon)

## Decisions ที่ยังไม่ตัดสินใจ

- [ ] เก็บ `CoverImagePreviewTab` หรือไม่ — INKSTUDIO ไม่มี explorer ดังนั้นเก็บไว้ก็ไม่ได้ใช้
- [ ] รักษา multi-tab editor หรือเปลี่ยนเป็น single-canvas surface — แนะ single
- [ ] เปลี่ยนชื่อ `useCoverEditor*` → `useCover*` (สั้นลง) หรือคงเดิม — แนะคงเดิมเพื่อให้ diff ง่าย
