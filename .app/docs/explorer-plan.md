# Explorer Sidebar — Plan (พักไว้)

วันที่: 2026-05-24 (พักไว้ก่อนนอน)

ค้างไว้ที่: รอเริ่มเขียน Explorer panel หลังจาก re-fork INKIDEA เสร็จและ merge เข้า main แล้ว

---

## 1. สิ่งที่ commit เสร็จรอบล่าสุด (53280fe)

Re-fork จาก INKIDEA — render + cover modules:

- Render: ปลดล็อค locked profile 144p/CRF 51 → คืน encoder dropdown + preset save/load + NVENC fix + smart cover matching + audio folder watcher + intro clip + folder dropdowns
- Cover: port INKIDEA updates ของไฟล์อื่น ๆ — เก็บ Photoshop UX ใน [setupCoverCanvas.ts](../shell/src/features/cover/setupCoverCanvas.ts), [CoverImagePreviewTab.tsx](../shell/src/features/cover/CoverImagePreviewTab.tsx), [useCoverEditor.ts](../shell/src/features/cover/useCoverEditor.ts) ไว้
- Electron IPC: ใหม่ — [render.cjs](../shell/electron/ipc/render.cjs) + [render/](../shell/electron/ipc/render/) + [helpers/](../shell/electron/helpers/)
- Tests: 118/118 pass · Build pass

---

## 2. งานต่อไป — Explorer Sidebar

User asked: "ให้มี explorer มีทั้ง เสียง ปก คลิป แบบเดียวกันเลย · แค่เสียงให้ user เลือกวาง · หรือกด browse file"

### Decisions ที่ user ยืนยันแล้ว

- **Layout**: ซ้ายมือ sidebar 3 ส่วน (collapsible) — **ไฟล์เสียง / ปก / คลิป**
- **Audio input**: เพิ่ม 2 ทาง — **Browse multiple files** (OS dialog · multi-select) + **Drag-and-drop** จาก OS Explorer
  (folder picker เดิมยังคงไว้)

### โครงสร้างที่จะวาง

ใหม่: ระหว่าง `Sidebar` activity bar กับ module content — sidebar กว้าง ~240 px แสดงเฉพาะตอน `activeModule === 'cover' | 'render'`

```
┌─────┬───────────┬──────────────────────┐
│ Act │ Explorer  │ Module content       │
│     │ ▼ เสียง   │                      │
│     │   ตอน 001 │                      │
│     │   ตอน 002 │                      │
│     │ ▼ ปก     │                      │
│     │   001.png│                      │
│     │ ▼ คลิป   │                      │
│     │   intro  │                      │
└─────┴───────────┴──────────────────────┘
```

### ไฟล์ที่จะเขียนใหม่

- `src/shell/Explorer.tsx` — sidebar panel + 3 sections
- `src/shell/ExplorerSection.tsx` — section ตัวเดียว (header + folder picker + file list)
- `src/state/useExplorer.ts` — zustand: 3 folder paths + 3 file lists + active selection
- `src/shell/useFolderListing.ts` — hook: list files in folder + auto-refresh เมื่อ watcher แจ้ง

### ไฟล์ที่ต้องแก้

- `src/App.tsx` — เพิ่ม `<Explorer />` ระหว่าง `<Sidebar />` กับ `<main>`
- `src/state/useStudio.ts` — sync explorer audio folder ↔ `useRender.audioFolder`, explorer cover folder ↔ `useRender.coverFolder` / `useCoverEditor`
- `electron/ipc/fs.cjs` — เพิ่ม `fs:list-dir-by-ext` (รับ folder + ext array) ถ้ายังไม่มี — หรือ filter ฝั่ง renderer ผ่าน `listDir` ที่มีอยู่
- `electron/preload.cjs` + `src/types/window.d.ts` — เพิ่ม method ถ้าจำเป็น
- `src/state/electronIpcShim.ts` — wrapper สำหรับ legacy code (อาจไม่ต้องแก้)

### Audio drag-and-drop

3 input paths รวมกันใน Audio section:

1. **Folder picker** (มีอยู่) → set `audioFolder` → list refresh อัตโนมัติ (watcher)
2. **"เลือกไฟล์..." button** → `inkstudio.fs.chooseFiles({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'ไฟล์เสียง', extensions: ['wav','mp3','m4a','aac','flac','ogg'] }] })` → กรอง path → append เข้า `selectedAudioFiles`
3. **Drop zone** → `onDrop` handler บน Audio section → `e.dataTransfer.files` → filter เฉพาะนามสกุลเสียง → append เข้า `selectedAudioFiles` (ใช้ `file.path` ของ Electron `File` object ที่มี absolute path)

หมายเหตุ: ทาง 2 + 3 = "ไฟล์เสียงไม่ต้องอยู่โฟลเดอร์เดียวกัน" — `useRender` ต้องรับ `selectedAudioFiles` ที่อาจเป็น path เต็ม ๆ ไม่ใช่แค่ filename. ปัจจุบัน `useRender.selectedAudioFiles` เป็น `Set<string>` ของ filename — ต้อง refactor เป็นรายการ path เต็ม หรือ map filename → folder map. **ตัดสินใจตอนเริ่ม**

### Cover + Clip sections

2 sections ที่เหลือ simpler:

- **ปก**: folder ← `useRender.coverFolder` หรือ `useStudio.coverOutput.folderPath`. ใช้ extension filter `['png','jpg','jpeg','webp']`. Click ไฟล์ = focus ใน cover module (อาจ open ใน CoverEditor)
- **คลิป**: folder ← `useRender.outputFolder` (ที่ render เพิ่งเขียนออกมา) + intro clip picker. Extension `['mp4','mov','mkv','webm']`. Click = preview ใน MediaPreview หรือ reveal in OS

### Tests

- `useExplorer.test.ts` — folder state + file filtering
- `Explorer.test.tsx` — render 3 sections, drag-drop accept .wav, reject .txt
- ขยาย `useRender.test.ts` — รับ path เต็มใน `selectedAudioFiles` ถ้า refactor

---

## 3. Open questions ตอบเอง (ไม่ต้องถาม user เพิ่ม)

- **เปิดทุก module หรือเฉพาะ cover/render?** → เฉพาะ cover + render. ไม่จำเป็นใน modules อื่น
- **Folder watcher แบบเดียวกับ render?** → ใช้ `render:watch-audio-folder` ที่ port มาแล้ว สำหรับ audio. ต้องเขียน watcher ใหม่สำหรับ cover folder + output folder (อาจสร้าง generic `fs:watch-dir`)
- **Drag-drop จากนอก app**: HTML5 drag-drop API. Electron exposes `file.path` บน `File` object. ใช้ `e.preventDefault()` + `e.dataTransfer.dropEffect = 'copy'`

---

## 4. Estimated scope

- ~6 new files + 4 modified
- ~600-900 LOC
- 30-45 นาที delegated to sub-agent
- Tests ใหม่ ~20 test cases

ตอนกลับมาทำต่อ — เริ่มที่: spawn worktree sub-agent ด้วย prompt ตาม Section 2 นี้
