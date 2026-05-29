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
| `render` | checkFfmpeg, listAudioFiles, getPreferredEncoder, startBatch, cancelJob, onProgress | **wired** — main process `render:start-batch-cover` + `render:cancel-job` (graceful `q`-quit), encoder detect/diagnose, smart cover matching, audio folder watcher, intro (วิดีโอ/เสียง) |
| `cover` | (script save/load ใช้ localStorage — ไม่ต้องการ IPC) | n/a |
| (legacy compat) | `window.electron.ipc.*` — INKIDEA-style surface | shimmed via `state/electronIpcShim.ts` → maps to `window.inkstudio.*`; presets ใช้ localStorage |

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
pnpm test                 # vitest run — 163/163 ผ่าน (รวม electron/**/*.test.ts)
                          #   coverEditorUtils (35) · electronIpcShim (27) · useRender (23)
                          #   renderConstants (16) · rangeSelectLogic (16) · useHubWorkspace (14)
                          #   updateVersion (12) · renderSummaryText (6) · renderAudioSelection (6) · useApp/useStudio (8)
                          # ffmpeg integration (ไม่ใช่ vitest — รันมือ):
                          #   node test/verify-intro.cjs   → 4 เคส intro เล่นได้จริง
                          #   node test/verify-cancel.cjs  → graceful cancel ได้ partial mp4 เล่นได้
pnpm build                # vite build → dist/ — ~1700 modules, ~640 KB JS, ~77 KB CSS

pnpm package:win          # NSIS + Portable → release/INKSTUDIO-Setup-0.1.0.exe (~106 MB)
                          #                  release/INKSTUDIO-Portable-0.1.0.exe (~106 MB)
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

### 2026-05-30 (release + CI)

- **First release v0.1.0 published** → https://github.com/snibzyz/inkstudio/releases/tag/v0.1.0
  - **Windows**: NSIS Setup + Portable + latest.yml (electron-updater auto-update ใช้ได้)
  - **macOS**: arm64 (Apple Silicon) dmg + zip + latest-mac.yml (custom mac updater ใช้ได้)
  - **Intel mac (x64) ตัดออก** — ดู `.github/workflows/release.yml` (ต้องใช้ macos-13 + job รวม manifest)
- **GitHub repo + CI release pipeline ใช้งานจริงแล้ว**: push tag `vX.Y.Z` → `.github/workflows/release.yml`
  build win (windows-latest) + mac arm64 (macos-latest) แล้ว attach ขึ้น Releases (ใช้ GITHUB_TOKEN)
- **Fix CI build**: vendor `.shared/tailwind/tokens.cjs` → `.app/shell/tailwind.tokens.cjs`
  (เดิม require จาก workspace parent นอก repo → CI/clone เดี่ยว build ไม่ผ่าน). resolveTokens
  fallback ไป vendored ถ้าไม่มี `.shared`
- **Auto-update tested**: แยก pure logic → `electron/updateVersion.cjs` (compareSemver/parseFileUrls/
  pickArchZip) + 12 vitest tests · vitest include เพิ่ม `electron/**/*.test.ts` · verify manifest จริง
  (size ใน latest.yml/latest-mac.yml ตรงกับ asset ที่ publish เป๊ะ → sha512 consistent)

### 2026-05-30

- **Magic select (เลือกตอน/ช่วง/ทีละ N)** — fork จาก INKIDEA ที่ตกหล่นตอน re-fork render
  - เพิ่ม `shared-ui/utils/rangeSelectLogic.ts` + `shared-ui/components/RangeSelectToolbar.tsx` + barrel exports
  - wire เข้า `RenderFilesSection` — "ช่วงตอน 1-50, 100-200" + "เลือกทีละ N" + คลิกซ้ำ = ยกเลิกกลุ่ม
- **Intro รองรับทั้งวิดีโอและเสียง** (เดิมวิดีโออย่างเดียว)
  - `renderConstants.ts`: เพิ่ม `INTRO_AUDIO_EXTENSIONS`, `INTRO_EXTENSIONS`, `classifyIntro()`
  - **วิดีโอ** → concat ระดับวิดีโอ (2-stage) · **เสียง** → merge เสียง intro+ตอน single-pass ใช้ปกตอนตลอดคลิป
  - **วิดีโอเงียบ (ไม่มี audio track)** → เติม `anullsrc` อัตโนมัติก่อน concat (probe ผ่าน `ffmpeg -i`, ไม่มี ffprobe)
  - `+aformat` harmonize sample-rate กัน glitch ตอน concat
  - UI: หัวข้อ "ไฟล์เปิด (intro)" + badge เสียง/วิดีโอ + hint อธิบายพฤติกรรม + picker รับ 2 ชนิด
- **Cancellation state (port INKIDEA)** — กด "หยุด" = graceful `q`-quit (ไฟล์ปัจจุบัน finalize เล่นได้)
  - `render:cancel-job` ใช้ `stopFfmpegChild` แทน SIGKILL · catch คืน summary `cancelled:true` แทน throw
  - `renderHelpers`: graceful timeout 4s→10s + เลิกเรียก `stdin.end()` (กัน muxer ไม่ finalize → ไฟล์พัง)
  - `RenderSummary.cancelled` + `renderSummaryText.ts` (pure) → ข้อความ "ยกเลิก: …/บันทึกบางส่วน"
- **Auto-refresh รายการเสียงตอนกลับเข้าโหมดคลิป** (polish จาก INKIDEA) — App.tsx unmount โมดูล
  ตอนสลับ → เพิ่ม mount-effect ใน `useRenderJob` (เทียบเท่า becameActive ของ INKIDEA) +
  แยก `reconcileAudioSelection()` (pure) คงการเลือกไฟล์ที่ยังมีอยู่
- **Tests — 151 passing** (+rangeSelectLogic 16, renderConstants +5 intro, renderSummaryText 6, renderAudioSelection 6)
  - + ffmpeg integration (รันมือ): `test/verify-intro.cjs` (4 เคส) · `test/verify-cancel.cjs` (partial เล่นได้)
- **หมายเหตุ**: render IPC handlers ใช้งานได้จริงแล้ว (note "TODO" เดิมล้าสมัย — re-fork 2026-05-15 wire ไว้)

### 2026-05-15

- **Fork ทั้ง Cover + Render module จาก INKIDEA** — ลบของเก่าทิ้ง (CoverCanvas Canvas2D 1437 บรรทัด + WIP fabric/ folder)
  - Cover: 16 ไฟล์ (~4378 LOC) — Fabric.js artboard + zoom/pan/smart-guides
  - Render: 12 ไฟล์ (~2262 LOC) → ลดเหลือ 4 sections + locked profile
- **Render profile fix** — 144p · 1 fps · CRF 51 · libx264 ultrafast · AAC 96 kbps (เร็วสุด ไฟล์เล็กสุด ทุกเครื่อง)
  - ลบ machine preset / encoding section / preset save-load
  - เพิ่ม **intro clip** picker — แทรกวิดีโอหน้าทุกตอน (ไม่บังคับ)
- **Photoshop UX บนแคนวาส**:
  - Pan: Space+drag, middle-mouse drag, **H key persistent hand tool**, V key exit
  - Cursor: open hand (`grab`) ตอน Space, closed hand (`grabbing`) ตอนลาก, `copy` ตอน Alt, `zoom-in/out` ตอน Ctrl+scroll
  - **Alt+drag = duplicate** (pre-clone cache + swap into stack on first object:moving)
  - Window:blur safety + document.body cursor ตอน drag เผื่อลากออกนอก host
  - Keyboard: Ctrl+0 fit / Ctrl+1 100% / Ctrl+± zoom / Ctrl+Z/Y / Ctrl+T / Ctrl+J / Delete / arrows (1px) / Shift+arrows (10px) / Ctrl+] / Ctrl+[ / Ctrl+Shift+] / [ / Ctrl+A / Ctrl+D / Esc
- **Infra**: 
  - Copy `@shared/ui` ทั้ง 40 ไฟล์จาก INKIDEA → `src/shared-ui/` + alias `@shared/ui` ใน vite/tsconfig
  - `useHubWorkspace` shim — INKSTUDIO ไม่มี workspace; map ไป `window.inkstudio.fs/shell`
  - `electronIpcShim` — `window.electron.ipc.*` (INKIDEA-style) → `window.inkstudio.*`; presets ใช้ localStorage
  - Render IPC contract เพิ่ม `introClipPath`, `fps`, `preset` fields
- **Tests — 106 passing**: coverEditorUtils (35) · useRender (18) · electronIpcShim (22) · useHubWorkspace (14) · renderConstants (9) · useApp/useStudio (8)
- **Build verified**: typecheck pass · vite build 1697 modules · NSIS + Portable installer ~106 MB
- **Docs**: README.md + architecture.md + CLAUDE.md updated to match new state

### 2026-05-13

- สร้าง app จาก `.shared/` template (port 5573 + namespace `window.inkstudio`)
- ทำ 2-sidebar shell (ปก / คลิป) เลียนแบบ INK family
- เขียน cover module เวอร์ชันแรก — canvas 1280×720, blur bg, foreground cover, title + chapter text layers, batch export พร้อม auto-numbering (ของเก่า — ภายหลังถูก fork จาก INKIDEA ทับใน 2026-05-15)
- เขียน vitest unit tests สำหรับ pure functions
- สร้าง useStudio cross-module store เพื่อ sync cover output → render input
- เปลี่ยน electron-builder จาก portable → NSIS + electron-updater
- ลบ `portableUpdate.cjs` (เก่า) · เขียน `autoUpdate.cjs` ใหม่บน electron-updater
- เขียน README.md (Thai user doc) + `.app/docs/architecture.md` (technical)
