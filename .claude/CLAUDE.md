# INKSTUDIO — Project Memory

INKSTUDIO เป็น **เครื่องมือทำปก + เรนเดอร์คลิปอ่านนิยาย** ในตระกูล INK
สร้างบน Electron + React + TypeScript + Vite + Tailwind — รันคู่กับ INKTTS (ที่ผลิตไฟล์เสียง)

ดูสรุปสำหรับผู้ใช้ที่ `../README.md` และ deep dive ทางเทคนิคที่ `../.app/docs/architecture.md`

---

## 1. Product Goal

- **โมดูลทำปก**: อัปโหลดภาพปกนิยาย 1 ภาพ → render canvas 1280×720 ที่มี blurred bg + foreground cover + title + chapter number → batch loop ทุกตอนตาม start/end/step/padding
- **โมดูลเรนเดอร์คลิป**: เลือกโฟลเดอร์ปก + โฟลเดอร์ไฟล์เสียง (จาก INKTTS) → FFmpeg combine → ได้ .mp4 ทุกตอน
- **Auto-numbering** ผ่าน token `{n}` ใน template ข้อความ เช่น `ตอนที่ {n}` → `ตอนที่ 001`, `ตอนที่ 002`, ...
- **Script (preset)** บันทึก/โหลด config ทั้งชุดได้ — เพื่อใช้ซ้ำกับนิยายเรื่องอื่น
- **Auto-update** ผ่าน NSIS installer + electron-updater (GitHub Releases + differential blockmap)

## 2. Repository Structure

```
INKSTUDIO/
├── .app/
│   ├── docs/architecture.md      ← technical architecture
│   └── shell/                    ← Electron + React (pnpm workspace package @inkstudio/desktop-shell)
│       ├── electron/             ← main process (.cjs CommonJS)
│       │   ├── main.cjs          ← BrowserWindow + IPC wiring
│       │   ├── preload.cjs       ← contextBridge → window.inkstudio
│       │   ├── autoUpdate.cjs    ← electron-updater orchestrator (NSIS / DMG)
│       │   ├── ipc/              ← window/fs/clipboard/dialog/settings/log/shell
│       │   └── helpers/          ← logger/paths
│       ├── src/                  ← renderer (React)
│       │   ├── App.tsx           ← 2-sidebar shell
│       │   ├── main.tsx, index.css
│       │   ├── shell/            ← Sidebar / TitleBar / StatusBar
│       │   ├── state/
│       │   │   ├── useApp.ts     ← activeModule
│       │   │   └── useStudio.ts  ← cover→render sync
│       │   ├── features/
│       │   │   ├── shared/       ← ModuleShell + PortStatusNotice
│       │   │   ├── cover/        ★ working — canvas, batch export, scripts
│       │   │   └── render/       UI placeholder — FFmpeg backend ยังไม่ wire
│       │   ├── types/window.d.ts
│       │   └── ui/               ← 8 primitives (copy จาก .shared/ui/)
│       ├── public/               ← logo.ico + logo.png (วันนี้ใช้ของ INKTTS placeholder)
│       ├── package.json
│       ├── vite.config.ts        ← port 5573
│       ├── tailwind.config.js    ← require '../../../.shared/tailwind/tokens.cjs'
│       └── tsconfig.json
├── .claude/CLAUDE.md             ← ไฟล์นี้
├── input/, output/               ← (gitignored — สำหรับ user เก็บไฟล์)
├── package.json (workspace root) ← delegate ไป @inkstudio/desktop-shell
├── pnpm-workspace.yaml
├── start.bat / install.bat
└── README.md                     ← user-facing doc ภาษาไทย
```

## 3. UI Design System (inherit จาก root CLAUDE.md)

- **Base**: VS Code Dark+ + amber brand `#F59E0B` (token `vscode-brand`)
- **Tokens**: ทุก color ใช้ `vscode-*` จาก `.shared/tailwind/tokens.cjs` — **ห้าม hardcode hex**
- **Primitives**: 8 ตัวจาก `.shared/ui/` — AppButton, AppCard, MacPanel, MacFieldLabel, MacHint, Codicon, Input, cn
- **Icons**: Codicon เท่านั้น (codicon-* names) — **ห้าม emoji**
- **Size**: h-8 + text-[12px]/[13px] + rounded-sm (INKIDEA dense)
- **Font**: Tahoma + Segoe UI + system-ui (Thai-friendly)
- **Spacing**: 4px/8px grid

## 4. Module Layout

แต่ละ feature มี folder ของตัวเองใน `src/features/<id>/` — แยกออกชัดเจน:

```
features/
├── shared/           ← ใช้ร่วมระหว่างโมดูล (ModuleShell, PortStatusNotice)
├── cover/            ← module: ทำปก
│   ├── index.tsx              entry + 7 sections + 2 helper components
│   ├── useCoverState.ts       zustand store
│   ├── coverRender.ts         pure functions (drawCover, formatChapterNumber, resolveChapterText)
│   ├── CoverCanvas.tsx        live preview <canvas> 1280×720
│   ├── batchExport.ts         async loop ที่ generate ทุกตอน + เขียน disk
│   └── __tests__/coverRender.test.ts  ← 8 unit tests (vitest)
└── render/           ← module: เรนเดอร์คลิป (UI เสร็จ · FFmpeg ยังไม่ wire)
    ├── index.tsx
    └── README.md     ← port plan + IPC contract
```

**ModuleShell** (`features/shared/ModuleShell.tsx`) — layout ใช้ร่วมกัน 2 โมดูล:
```
┌────────────────────────────────────────────────────────────┐
│ [icon] [Title]  [subtitle]                                 │ ← header
├──────────┬──────────────────────────┬──────────────────────┤
│ [Steps]  │ [Active section]         │ [Preview canvas]     │
│ 1. Foo   │ <MacPanel>               │                      │
│ 2. Bar   │ ...                      │                      │
│ 3. Baz   │ </MacPanel>              │                      │
└──────────┴──────────────────────────┴──────────────────────┘
```

## 5. Cover Render Pipeline (canvas 1280×720)

```
[base image] → cover-fit + ctx.filter='blur(N px)' → dim overlay rgba(0,0,0,α)
            → drawForegroundCover (2:3 portrait + roundedRect + shadow)
            → drawTextLayer(title)
            → drawTextLayer(chapter)  ← resolveChapterText(template, n, padding)
                                          replace {n} → '001', '002', ...

→ canvas.toDataURL(mime, q)
→ dataUrlToBase64
→ window.inkstudio.fs.writeBytes(path, base64)
```

`coverRender.ts` ทั้งหมดเป็น pure functions ที่ unit-test ได้ใน vitest (8/8 ผ่าน)

## 6. IPC Surface (preload → renderer ผ่าน `window.inkstudio`)

| Namespace | Methods | สถานะ |
|---|---|---|
| `app` | version, checkUpdate, applyUpdate, onUpdateAvailable, onUpdateProgress, onUpdateDownloaded, onUpdateError | wired (electron-updater) |
| `window` | minimize, maximize, close, isMaximized, toggleDevTools, reload, setTitle | wired |
| `fs` | chooseFolder, chooseFile, chooseFiles, readText, writeText, readBytes, writeBytes, listDir, mkdir, rm, rename, stat, exists, revealFolder, openExternal | wired |
| `clipboard` | readText, writeText, clear | wired |
| `dialog` | message, confirm, saveFile | wired |
| `settings` | get, patch, setKey, reset, onChange | wired |
| `log` | info, warn, error, debug, getLogPath | wired |
| `shell` | showItemInFolder, beep | wired |
| `render` | startBatchCoverRender, cancelRenderJob, onProgress, listPresets, savePreset, deletePreset, listAudioFiles, getPreferredEncoder | **TODO** (ดู `src/features/render/README.md`) |
| `cover` | (script save/load ใช้ localStorage — ไม่ต้องการ IPC) | n/a |

## 7. Auto-Update — NSIS + electron-updater

ใช้ pattern ที่ standard กว่า portable + custom helper-cmd:

1. ทุก 30 นาที (+ ครั้งแรก 5 วิหลังเปิด) → `autoUpdater.checkForUpdates()`
2. มี version ใหม่ → emit `app:updateAvailable` + auto download (autoDownload=true)
3. ระหว่าง download → emit `app:updateProgress` (percent + bytes + speed)
4. download เสร็จ → emit `app:updateDownloaded`
5. user กดปุ่ม / app quit → `quitAndInstall()` → NSIS uninstall + reinstall

**Diff updates**: NSIS + electron-updater รองรับ `differentialPackage` — ดาวน์โหลดเฉพาะ block ที่เปลี่ยน

GitHub repo: `snibzyz/inkstudio` (ยังไม่สร้าง · ตั้งใน `package.json > build > publish`)

## 8. Build / Verify

```bash
pnpm dev                  # Vite (5573) + Electron พร้อมกัน
pnpm typecheck            # ตรวจ TS — ปัจจุบันผ่าน
pnpm test                 # vitest run — 8/8 ผ่าน (coverRender pure functions)
pnpm build                # vite build → dist/ — 67 modules, 197 KB JS, 45 KB CSS

pnpm package:win          # NSIS installer → release/INKSTUDIO-Setup-0.1.0.exe (82 MB)
pnpm publish:win          # + publish ไป GitHub Releases (ต้อง GH_TOKEN)
```

## 9. Verification Rules — ห้ามรายงานเสร็จก่อนเทส

(เหมือน INKTTS/INKCRAW)

- ทุกการแก้ที่แตะ `coverRender.ts` หรือ `batchExport.ts` ต้อง re-run `pnpm test`
- ทุกการแก้ที่แตะ `electron/` ต้อง re-run `pnpm package:win` ตรวจว่า build ผ่าน
- ห้าม mark "เสร็จ" จนกว่า typecheck + test + build จะผ่านครบ
- การ port โมดูล render: ห้าม mark "เสร็จ" จนกว่าจะ render mp4 ที่ play ได้จริง 1 ไฟล์เป็นอย่างน้อย

## 10. Port Numbers

| App | Vite port |
|---|---|
| INKIDEA | 5173 |
| INKCRAW | 5273 |
| INKWRIGHT | 5373 |
| INKTTS | 5473 |
| **INKSTUDIO** | **5573** |

ห้ามเปลี่ยน port โดยไม่อัพเดต `vite.config.ts` + `dev:electron` script (`wait-on http://localhost:5573`) + `electron/main.cjs` (`loadURL('http://localhost:5573')`) พร้อมกัน

## 11. รักษา UX สม่ำเสมอข้ามแอป

- ใช้ token `vscode-*` ของ workspace `.shared/tailwind/tokens.cjs` — copy ทั้งชุด ห้ามเปลี่ยนค่า
- ใช้ AppButton + Codicon + AppCard ของ `.shared/ui/` — ห้ามสร้างปุ่ม/การ์ดใหม่
- Sidebar pattern เลียนแบบ INKIDEA hub (left activity bar + icon + label)
- ModuleShell pattern (left section nav + main + preview) ใช้ทั้ง 2 โมดูล — ห้ามเขียน layout เฉพาะ
- ห้าม emoji ใน UI source — ใช้ codicon เท่านั้น

## 12. การเปลี่ยนแปลงล่าสุด

### 2026-05-13

- สร้าง app จาก `.shared/` template (port 5573 + namespace `window.inkstudio`)
- ทำ 2-sidebar shell (ปก / คลิป) เลียนแบบ INK family
- เขียน cover module ครบ — canvas 1280×720, blur bg, foreground cover, title + chapter text layers, batch export พร้อม auto-numbering
- เขียน vitest unit tests สำหรับ pure functions (8/8 ผ่าน)
- สร้าง useStudio cross-module store เพื่อ sync cover output → render input
- เปลี่ยน electron-builder จาก portable → NSIS + electron-updater
- ลบ `portableUpdate.cjs` (เก่า) · เขียน `autoUpdate.cjs` ใหม่บน electron-updater
- เขียน README.md (Thai user doc) + `.app/docs/architecture.md` (technical)
- Render module: UI placeholder + roadmap ครบใน `features/render/README.md`
