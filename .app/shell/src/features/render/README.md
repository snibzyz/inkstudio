# `features/render/` — โมดูลเรนเดอร์คลิป

> สถานะ: **skeleton เท่านั้น** — `index.tsx` แสดง UI placeholder + form แหล่งข้อมูลแบบ static

## Product goal

เรนเดอร์วิดีโอจาก **ปก (เดี่ยวหรือหลายปก) + ไฟล์เสียง** เป็นชุดผ่าน FFmpeg —
ผู้ใช้เลือก: ภาพปก → โฟลเดอร์เสียง → โฟลเดอร์ปลายทาง → encoder/CRF/resolution → เลือกไฟล์เสียงที่จะ render → start

มี **machine preset 3 ระดับ**: คอมกาก (S/H.264, CRF 30, 480p) · คอมกลาง (S/H.264, CRF 26, 720p) · คอมเทพ (NVENC H.264, CRF 22, 1080p)

มี **batch preset** (server-side json) สำหรับ save config ทั้งชุด

## ที่มา

Port จาก **INKIDEA `.app/shell/src/workspace/render/`** (13 ไฟล์, ~2,260 บรรทัด)

```
INKIDEA render/
├── RenderTab.tsx               470 — main + workspace tab wrapper (ตัด workspace ทิ้ง)
├── RenderSettingsPane.tsx      124 — settings shell + sections nav (เขียนใหม่เพราะใช้ HubIdeSettingsShell ของ INKIDEA)
├── useRender.ts                372 — zustand store (เกือบทั้งหมดใช้ได้เลย — ลบแค่ resetForActiveProject + appliedProjectId)
├── useRenderJob.ts             291 — bridge ไป IPC (ใช้ได้เลย ถ้า preload namespace ตรง)
├── renderConstants.ts           82
├── renderTypes.ts                69
└── sections/                    7 ไฟล์
    ├── RenderOverviewSection.tsx    96
    ├── RenderSourceSection.tsx     152
    ├── RenderEncodingSection.tsx   105
    ├── RenderPresetsSection.tsx    164
    ├── RenderFilesSection.tsx      141
    ├── RenderProgressSection.tsx   131
    └── RenderQuickActions.tsx       65
```

## แผนการ port

### ขั้น 1 — Copy core ที่ใช้ได้ทันที

ไฟล์ที่ port มาแก้เกือบไม่ต้องเลย:

- `renderConstants.ts` — เปลี่ยน `STORAGE_KEY: 'inkidea:render:...'` → `'inkstudio:render:...'`
- `renderTypes.ts` — copy ตรง
- `useRender.ts` — copy แล้วลบ `appliedProjectId`, `resetForActiveProject`
- `useRenderJob.ts` — copy แล้วเปลี่ยน `window.electron?.ipc` → `window.inkstudio?.ipc` (ดู preload)
- `sections/*` — copy ตรง (จะใช้ `AppButton`, `Input` แทน `hubSettingsInputClass` ที่เป็นของ INKIDEA)

### ขั้น 2 — เขียน RenderSettingsPane ใหม่

ของเดิมพึ่ง `HubIdeSettingsShell` ที่เป็น component หนักของ INKIDEA — INKSTUDIO ใช้ sidebar ของตัวเองอยู่แล้ว ใช้ tab navigation ภายในโมดูลแทน (มี skeleton แล้วใน `index.tsx`)

### ขั้น 3 — IPC backend (สำคัญที่สุด)

ต้อง port handler ใน main process (อยู่ใน INKIDEA `electron/ipc/render.cjs`):

```
render:start-batch-cover    — เริ่ม render job (FFmpeg)
render:cancel-job           — หยุด job
render:progress             — event ส่ง progress payload
render:get-preferred-encoder — แนะนำ encoder ตาม GPU
preset:list                 — โหลด preset
preset:save                 — บันทึก preset
preset:delete               — ลบ preset
fs:list-audio-files         — list audio ในโฟลเดอร์
dialog:select-files         — open dialog (มีใน .shared แล้ว)
```

ดู INKIDEA `electron/ipc/render.cjs` + `electron/audio/` สำหรับ FFmpeg orchestration

### ขั้น 4 — Bundle FFmpeg

INKIDEA bundle FFmpeg ผ่าน `ffmpeg-static` (npm) — ตรวจ package.json + main process ของ INKIDEA หาวิธี resolve path ตอน packaged

## Deps ที่ต้องเพิ่ม

- `ffmpeg-static` หรือ `ffmpeg.wasm` (เลือกอันใดอันหนึ่ง)
- `lucide-react` (ถ้ายังใช้ icon ใน sections เดิม) — หรือ refactor เป็น Codicon
- main process: `child_process.spawn` (มีอยู่แล้ว node built-in)

## เปรียบเทียบ preload namespace

| INKIDEA                              | INKSTUDIO (ต้องเพิ่ม)              |
|--------------------------------------|------------------------------------|
| `window.electron.ipc.startBatchCoverRender` | `window.inkstudio.ipc.startBatchCoverRender` |
| `window.electron.ipc.cancelRenderJob`        | `window.inkstudio.ipc.cancelRenderJob`        |
| `window.electron.ipc.onRenderProgress`       | `window.inkstudio.ipc.onRenderProgress`       |
| `window.electron.ipc.listPresets`            | `window.inkstudio.ipc.listPresets`            |
| `window.electron.ipc.savePreset`             | `window.inkstudio.ipc.savePreset`             |
| `window.electron.ipc.deletePreset`           | `window.inkstudio.ipc.deletePreset`           |
| `window.electron.ipc.listAudioFiles`         | `window.inkstudio.ipc.listAudioFiles`         |
| `window.electron.ipc.selectFiles`            | `window.inkstudio.ipc.selectFiles`            |
| `window.electron.ipc.getPreferredEncoder`    | `window.inkstudio.ipc.getPreferredEncoder`    |
