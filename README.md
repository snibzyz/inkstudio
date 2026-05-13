# INKSTUDIO

โปรแกรมสร้าง **ปกตอน + คลิปอ่านนิยาย** ของช่อง YouTube/TikTok นิยาย — ทำงานคู่กับ INKTTS (ที่ผลิตไฟล์เสียง)

อัปโหลดภาพปก 1 ภาพ → ตั้ง template ชื่อเรื่อง + เลขตอน → กดเริ่ม → ได้ปก 1280×720 ครบทุกตอน → เลือกเสียงจาก INKTTS → กดเรนเดอร์ → ได้คลิป .mp4 พร้อม upload

---

## สารบัญ

1. [เริ่มต้นใช้งาน](#เริ่มต้นใช้งาน)
2. [โฟลเดอร์ต่าง ๆ — วางไฟล์อะไรที่ไหน](#โฟลเดอร์ต่าง-ๆ--วางไฟล์อะไรที่ไหน)
3. [ขั้นตอนภาพรวม](#ขั้นตอนภาพรวม)
4. [โมดูล "ทำปก"](#โมดูล-ทำปก)
5. [โมดูล "เรนเดอร์คลิป"](#โมดูล-เรนเดอร์คลิป)
6. [Auto-numbering — token `{n}`](#auto-numbering--token-n)
7. [Sync ปก → คลิป](#sync-ปก--คลิป)
8. [Machine preset — กาก/กลาง/เทพ](#machine-preset--กากกลางเทพ)
9. [Script (preset) save/load](#script-preset-saveload)
10. [อัปเดตอัตโนมัติ](#อัปเดตอัตโนมัติ)
11. [คุณสมบัติ standalone](#คุณสมบัติ-standalone)
12. [แก้ปัญหาที่พบบ่อย](#แก้ปัญหาที่พบบ่อย)
13. [สำหรับนักพัฒนา](#สำหรับนักพัฒนา)

---

## เริ่มต้นใช้งาน

### บนเครื่อง Windows

| ไฟล์ที่โหลด | เหมาะกับ |
|---|---|
| **`INKSTUDIO-Setup-x.x.x.exe`** | ติดตั้งแบบปกติ (มี shortcut + auto-update) |
| **`INKSTUDIO-Portable-x.x.x.exe`** | ไม่ต้องติดตั้ง วางที่ไหนก็ได้ ไฟล์เดียวจบ |

1. ดาวน์โหลดจาก [หน้าดาวน์โหลด](https://github.com/snibzyz/inkstudio/releases/latest)
2. ดับเบิลคลิก
3. ถ้ามีแถบเตือนของ Windows → **More info** → **Run anyway**

### บนเครื่อง Mac

1. ดาวน์โหลด `INKSTUDIO-x.x.x.dmg`
2. **ครั้งแรก**: คลิกขวาที่ไอคอน → **Open** → **Open** อีกครั้ง (อย่าดับเบิลคลิก)
3. ครั้งต่อไปเปิดได้ปกติ

> ไม่ต้องลง FFmpeg, Python, Node — มีให้ครบในไฟล์เดียว

---

## โฟลเดอร์ต่าง ๆ — วางไฟล์อะไรที่ไหน

INKSTUDIO ไม่บังคับโครงสร้างโฟลเดอร์ — เลือกที่ไหนก็ได้ผ่าน dialog

### ที่ "คุณ" เตรียมไว้

| สิ่งที่ต้องเตรียม | วางที่ไหน |
|---|---|
| **ภาพปกต้นแบบ** (.png / .jpg / .webp) | ที่ไหนก็ได้ — เลือกผ่าน dialog ในโมดูล "ทำปก" |
| **ไฟล์เสียง** (.m4a / .mp3 / .wav จาก INKTTS) | โฟลเดอร์ใดก็ได้ — เลือกผ่าน dialog ในโมดูล "คลิป" |

### ที่ "ระบบ" สร้างให้

| โฟลเดอร์ | ระบบใส่อะไรให้ |
|---|---|
| **โฟลเดอร์ปกที่คุณเลือก** | ปก batch ทุกตอน เช่น `001.png`, `002.png`, ... |
| **โฟลเดอร์คลิปที่คุณเลือก** | คลิป .mp4 ทุกตอน เช่น `001.mp4`, `002.mp4`, ... |

### Script + presets เก็บที่ไหน

- **Cover script** (template ของปก) — เก็บใน localStorage ของแอป
- **Render preset** (config การเรนเดอร์) — เก็บใน localStorage
- **Log file** — `%APPDATA%\@inkstudio\desktop-shell\inkstudio.log` (Windows)

---

## ขั้นตอนภาพรวม

```mermaid
flowchart TD
    Start(["เปิด INKSTUDIO"]) --> Cover["โมดูล &quot;ทำปก&quot;"]

    Cover --> Upload["อัปโหลดภาพปก<br/>นิยาย 1 ภาพ"]
    Upload --> Title["ใส่ชื่อเรื่อง<br/>+ template เลขตอน"]
    Title --> Range["ระบุช่วง เริ่ม-จบ<br/>+ ต่อชุด + เติมศูนย์"]
    Range --> ExportC["กด &quot;เริ่มส่งออก&quot;"]
    ExportC --> Covers[("ปกครบทุกตอน<br/>001.png 002.png ...")]

    Covers -->|"sync auto"| Render["โมดูล &quot;เรนเดอร์คลิป&quot;"]

    Render --> AudioPick["เลือกโฟลเดอร์เสียง<br/>จาก INKTTS"]
    AudioPick --> Encoder["เลือก encoder + CRF + res<br/>หรือใช้ machine preset"]
    Encoder --> Files["เลือกไฟล์เสียง<br/>ที่จะเรนเดอร์"]
    Files --> RunR["กด &quot;เริ่มเรนเดอร์&quot;"]
    RunR --> Clips[("คลิป .mp4 ครบทุกตอน<br/>พร้อม upload")]

    INKTTS(["INKTTS<br/>แปลงข้อความ-เสียง"]) -.->|".m4a"| AudioPick

    classDef step fill:#fff7ed,stroke:#f97316,stroke-width:2px,color:#7c2d12
    classDef tool fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef result fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#1e3a8a
    classDef external fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#581c87

    class Upload,Title,Range,ExportC,AudioPick,Encoder,Files,RunR step
    class Cover,Render tool
    class Covers,Clips result
    class INKTTS external
```

> สีส้ม = ขั้นตอนที่คุณทำ · สีเหลือง = โมดูลในแอป · สีฟ้า = ผลลัพธ์ · สีม่วง = แอปอื่น (INKTTS)

---

## โมดูล "ทำปก"

แท็บแรกใน sidebar ซ้าย — สร้างปก batch ที่ canvas 1280×720 (frame ของวิดีโอ 16:9) จากภาพปกนิยาย 1 ภาพ

### ขั้นตอน (5 sections ใน sidebar ของโมดูล)

| ขั้น | section | ทำอะไร |
|:---:|---|---|
| 1 | **ภาพปก** | อัปโหลด `.png` / `.jpg` / `.webp` 1 ไฟล์ |
| 2 | **พื้นหลัง · ปก** | ปรับ blur ของ bg + ขนาด/ตำแหน่งของปก foreground (2:3) + มุมโค้ง + เงา |
| 3 | **ชื่อเรื่อง** | ข้อความคงที่ — ตำแหน่ง · สี · ขนาด · weight |
| 4 | **เลขตอน (auto)** | template `{n}` เช่น `ตอนที่ {n}` — token ถูก replace ตอน render |
| 5 | **ส่งออก batch** | เริ่ม · จบ · ต่อชุด · เติมศูนย์ · format (png/jpg) · ปลายทาง · เริ่มส่งออก |

มี section **สคริปต์** เพิ่ม เพื่อบันทึก/โหลด preset ทั้งชุด

### Pipeline ของการ render 1 ตอน

```mermaid
flowchart LR
    BaseImg["ภาพปก<br/>ต้นแบบ"] --> BG["1. cover-fit เต็ม canvas<br/>+ blur N px"]
    BG --> Dim["2. dim overlay<br/>rgba(0,0,0,α)"]
    Dim --> FG["3. foreground cover<br/>(2:3, rounded, shadow)"]
    FG --> Title["4. วาดชื่อเรื่อง<br/>(stroke + fill)"]
    Title --> Chap["5. วาดเลขตอน<br/>{n} → 001"]
    Chap --> Out[("PNG/JPG<br/>1280×720")]

    classDef bg fill:#fff7ed,stroke:#f97316,color:#7c2d12
    classDef text fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef result fill:#d1fae5,stroke:#059669,color:#064e3b

    class BG,Dim,FG bg
    class Title,Chap text
    class Out result
```

> Preview canvas ทางขวาของหน้าจอ render ทันทีทุกครั้งที่เปลี่ยน config — มี slider เลื่อนเลขตอนเพื่อดูตัวอย่างหลายตอน

---

## โมดูล "เรนเดอร์คลิป"

แท็บที่สองใน sidebar — combine ปก + ไฟล์เสียง → .mp4 ผ่าน FFmpeg (bundle มาในแอป)

### ขั้นตอน (6 sections ใน sidebar ของโมดูล)

| ขั้น | section | ทำอะไร |
|:---:|---|---|
| — | **ภาพรวม** | แสดงสถานะ FFmpeg + flow ภาพรวม |
| 1 | **แหล่งข้อมูล** | ปกเดียวหรือโฟลเดอร์ปก · โฟลเดอร์ไฟล์เสียง · ปลายทาง · คำนำหน้า |
| 2 | **การเข้ารหัส** | Encoder · CRF (18–30) · resolution (480p/720p/1080p) |
| 3 | **พรีเซ็ต** | Machine preset (กาก/กลาง/เทพ) + custom preset |
| 4 | **ไฟล์เสียง** | เลือกไฟล์เสียงทีละไฟล์หรือทั้งหมด · search filter |
| 5 | **เรนเดอร์** | เริ่ม · ดู progress real-time · ยกเลิก |

### Pipeline ของการ render 1 คลิป

```mermaid
flowchart LR
    Cover["ปก<br/>(.png/.jpg)"] --> FFmpeg{{"FFmpeg<br/>ในตัวแอป"}}
    Audio["เสียง<br/>(.m4a/.mp3)"] --> FFmpeg
    Encoder[/"encoder + CRF + res"/] -.-> FFmpeg

    FFmpeg --> Scale["scale + crop<br/>ตาม resolution"]
    Scale --> Encode["encode<br/>(libx264 / NVENC)"]
    Encode --> Mux["mux<br/>video + AAC audio"]
    Mux --> MP4[("คลิป .mp4<br/>ครบทุกตอน")]

    classDef io fill:#fff7ed,stroke:#f97316,color:#7c2d12
    classDef proc fill:#fef3c7,stroke:#d97706,color:#78350f
    classDef result fill:#dbeafe,stroke:#2563eb,color:#1e3a8a

    class Cover,Audio io
    class Scale,Encode,Mux proc
    class FFmpeg result
    class MP4 result
```

### Multi-cover mode

ถ้าใช้ **โฟลเดอร์ปก (ไม่ใช่ปกเดียว)** — INKSTUDIO จะ match audio file กับ cover file ตามชื่อ (ไม่นับ extension, case-insensitive)

```mermaid
flowchart LR
    A["audio/001.m4a"] -.-> M{{"match name<br/>(ไม่นับ ext)"}}
    B["audio/002.m4a"] -.-> M
    C["audio/003.m4a"] -.-> M

    M --> X["cover/001.png"]
    M --> Y["cover/002.png"]
    M --> Z["cover/003.png"]

    X --> R1[("001.mp4")]
    Y --> R2[("002.mp4")]
    Z --> R3[("003.mp4")]
```

ถ้าหาปกที่ match ไม่เจอ → ข้ามตอนนั้น + แสดงในรายการ "missingCovers"

---

## Auto-numbering — token `{n}`

ใส่ `{n}` ในข้อความของ "เลขตอน" → จะถูก replace ด้วยเลขตอนที่ pad ด้วยศูนย์ตาม padding setting

| Template | Start | End | Padding | ตัวอย่างผลลัพธ์ |
|---|:---:|:---:|:---:|---|
| `ตอนที่ {n}` | 1 | 100 | 3 | `ตอนที่ 001`, `ตอนที่ 002`, ..., `ตอนที่ 100` |
| `EP {n}` | 1 | 50 | 2 | `EP 01`, `EP 02`, ..., `EP 50` |
| `บทที่ {n} ภาคพิเศษ` | 1 | 12 | 2 | `บทที่ 01 ภาคพิเศษ`, ..., `บทที่ 12 ภาคพิเศษ` |

รองรับ `{n}` หลายตำแหน่งใน template เดียวด้วย (replace ทุกตำแหน่ง)

---

## Sync ปก → คลิป

หลังกด "เริ่มส่งออก" ในโมดูลทำปก → ระบบบันทึก path ของโฟลเดอร์ปลายทางไว้

เมื่อเปิดโมดูล "คลิป" → section "แหล่งข้อมูล" แสดง card สีส้ม:

```mermaid
sequenceDiagram
    participant U as User
    participant C as โมดูล &quot;ทำปก&quot;
    participant S as useStudio (state กลาง)
    participant R as โมดูล &quot;คลิป&quot;

    U->>C: กด &quot;เริ่มส่งออก&quot;
    C->>C: render ปก batch ทุกตอน
    C->>S: setCoverOutput(folder + updatedAt)
    U->>R: เปิดโมดูลคลิป
    R->>S: get coverOutput
    S->>R: { folder, updatedAt }
    R-->>U: แสดง card &quot;ใช้ปกล่าสุด&quot;
    U->>R: กด &quot;ใช้ปกล่าสุด&quot;
    R->>R: setCoverFolder(folder)
```

---

## Machine preset — กาก/กลาง/เทพ

3 preset ที่กดทีเดียวเซ็ต encoder + CRF + resolution พร้อมกัน

| Preset | Encoder | CRF | Resolution | เหมาะกับ |
|---|---|:---:|:---:|---|
| **คอมกาก** | Software H.264 | 30 | 480p | คอมเก่า · แล็ปท็อปไม่มี GPU |
| **คอมกลาง** | Software H.264 | 26 | 720p | คอมทั่วไป |
| **คอมเทพ** | NVENC H.264 | 22 | 1080p | คอมที่มี GPU NVIDIA |

> ปรับ encoder/CRF/res เองได้ตลอด — ถ้าค่าตรงกับ preset ใด ระบบจะ highlight ให้

---

## Script (preset) save/load

INKSTUDIO มี 2 ประเภท preset แยกกัน

### Cover script (ทำปก)

เก็บ: pixel ของ blur · dim · foreground cover (ขนาด/ตำแหน่ง/มุมโค้ง/เงา) · title text layer · chapter template · batch range · padding · format

ใช้ซ้ำกับนิยายเรื่องอื่น — แค่อัปโหลดภาพใหม่ + load script

### Render preset (เรนเดอร์คลิป)

เก็บ: cover/audio/output paths · encoder · CRF · resolution · title prefix

ใช้ซ้ำกับ project เดิม — เปลี่ยน path เฉพาะที่เปลี่ยน

ทั้งคู่เก็บใน localStorage ของแอป

---

## อัปเดตอัตโนมัติ

INKSTUDIO ใช้ **NSIS installer + electron-updater** (Windows) / DMG + electron-updater (Mac)

```mermaid
sequenceDiagram
    participant A as INKSTUDIO
    participant G as GitHub Releases
    participant U as User

    A->>A: boot — ตรวจ single-instance lock ก่อน
    A->>A: clearStaleCaches() — ล้าง Chromium cache
    A->>G: check release (ทุก 30 นาที + รอบแรกหลัง 5 วิ)
    G-->>A: latest.yml + blockmap
    alt มี version ใหม่
        A->>G: download installer (diff via blockmap)
        G-->>A: ดาวน์โหลดเสร็จ
        A-->>U: แสดง banner &quot;รีสตาร์ทเพื่ออัพเดต&quot;
        U->>A: กดปุ่ม
        A->>A: quitAndInstall() — NSIS install ใหม่ + restart
    else ไม่มี version ใหม่
        A->>A: รอ 30 นาที check ใหม่
    end
```

### กันปัญหา cache เมื่อมีการเปิดหลาย instance

| ปัญหา | วิธีกัน |
|---|---|
| User เปิดแอป 2 ครั้ง พร้อมกัน | **Single-instance lock** — instance ที่ 2 quit ทันที + ส่ง signal ให้ตัวแรก focus |
| Chromium cache เสียทำให้ค้าง | **clearStaleCaches()** ลบ `Cache/`, `Code Cache/`, `GPUCache/`, `Shader Cache/` ทุกครั้งบูต |
| Disk cache ของ HTTP | **disable-http-cache** + **disable-gpu-shader-disk-cache** command-line switch |
| Update folder corrupt | electron-updater จัดการ resume + hash verify เอง — เราไม่แตะ |
| ดาวน์โหลด update ซ้ำหลาย instance | ไม่มี — เพราะ single-instance lock เพียง 1 process เท่านั้นที่ตรวจ + ดาวน์โหลด |

---

## คุณสมบัติ standalone

> User ไม่ต้องลงโปรแกรมเสริมใด ๆ

| ตัวที่ bundle มา | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| **Electron** | 32 | runtime + Chromium 130 |
| **FFmpeg** (ffmpeg-static) | 6.1.1 | render mp4 จากปก + เสียง |
| **electron-updater** | 6.3.9 | NSIS / DMG auto-update via GitHub Releases |

FFmpeg bundle มีในตัว config NVENC + libx264 + libx265 + AAC ครบ — อ่าน [.app/docs/architecture.md](./.app/docs/architecture.md) สำหรับรายละเอียดทาง technical

---

## แก้ปัญหาที่พบบ่อย

### แอปเปิดไม่ขึ้น / ต้องผ่าน Windows SmartScreen

INKSTUDIO **ยังไม่ได้ลงนาม code signing** — Windows จะเตือนว่า "Windows protected your PC"

แก้: กด **More info** → **Run anyway**

### Preview canvas ขึ้นเป็น amber gradient

= ยังไม่ได้อัปโหลดภาพปก ไปที่ section **ภาพปก** แล้วเลือกไฟล์

### "FFmpeg ไม่พร้อม"

ดูใน section **ภาพรวม** ของโมดูลคลิป — ถ้าเขียนว่า "ไม่พร้อม" ให้:
1. ดาวน์โหลด INKSTUDIO ใหม่ (รุ่นล่าสุด)
2. ถ้ารัน dev mode — รัน `pnpm install` ใหม่

### เปิดแอปแล้วไม่ขึ้น (เคยมี window มาก่อน)

ระบบมี **single-instance lock** — ถ้ามี instance ก่อนหน้าค้างใน task manager ให้ kill ก่อน

### Auto-update ไม่ทำงาน

- **dev mode** — ตั้งใจ skip (`NODE_ENV === 'development'`)
- **packaged** — ตรวจว่าเปิดเชื่อมเน็ตได้ + ดู log ที่ `%APPDATA%\@inkstudio\desktop-shell\inkstudio.log`
- ถ้า log บอก 404 — repo ยังไม่มี release นั้น

### Reset settings

ลบ localStorage ของแอป — กด `F12` → Application → Local Storage → ลบ key ที่ขึ้นต้นด้วย `inkstudio:`

---

## สำหรับนักพัฒนา

```bash
cd "INKSTUDIO/"
pnpm install            # หรือดับเบิลคลิก install.bat
pnpm dev                # หรือดับเบิลคลิก start.bat
```

Dev server รันที่ port **5573** + Electron จะเปิดอัตโนมัติ

### Verification commands

```bash
pnpm typecheck          # ตรวจ TS
pnpm test               # vitest run — 68 tests
pnpm build              # vite build → dist/

# Node-side tests (electron + ffmpeg)
node --test electron/__tests__/*.test.cjs   # 26 tests

# Package
pnpm package:win        # NSIS installer + Portable
pnpm package:mac        # DMG

# Publish (ต้อง GH_TOKEN)
pnpm publish:win        # + publish ไป GitHub Releases
```

### โครงสร้าง

```
INKSTUDIO/
├── .app/
│   ├── docs/architecture.md      ← technical reference
│   └── shell/                    ← pnpm workspace package
│       ├── electron/             ← main process
│       │   ├── main.cjs          ← + single-instance + cache hardening
│       │   ├── preload.cjs       ← contextBridge → window.inkstudio
│       │   ├── autoUpdate.cjs    ← electron-updater
│       │   ├── ipc/render.cjs    ← FFmpeg orchestration
│       │   ├── ipc/renderHelpers.cjs ← pure helpers (testable)
│       │   ├── helpers/ffmpeg.cjs  ← path resolve (asar unpack handling)
│       │   └── __tests__/        ← node test runner
│       └── src/                  ← React renderer
│           ├── App.tsx           ← 2-sidebar shell
│           ├── shell/            ← Sidebar / TitleBar / StatusBar
│           ├── state/            ← useApp / useStudio
│           ├── features/
│           │   ├── cover/        ← canvas + batch export + scripts
│           │   ├── render/       ← FFmpeg orchestration + presets
│           │   └── shared/       ← ModuleShell + PortStatusNotice
│           └── ui/               ← 8 primitives (จาก .shared/ui/)
├── .claude/CLAUDE.md             ← developer memory
├── package.json (workspace root)
├── pnpm-workspace.yaml
├── start.bat / install.bat
└── README.md (ไฟล์นี้)
```

ดูรายละเอียดทาง technical ที่ [`.app/docs/architecture.md`](./.app/docs/architecture.md) และ memory ของนักพัฒนาที่ [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)

---

## License + ที่มา

- โครงสร้าง shell มาจาก **INKTTS** (พี่น้องตระกูล INK)
- UI primitives มาจาก **INKIDEA** hub
- Brand amber `#F59E0B` มาจาก **INKREALM**
- Auto-update ใช้ `electron-updater`
- FFmpeg ใช้ `ffmpeg-static` (FFmpeg 6.1.1 gyan.dev build)
- Canvas pure functions (testable in Node ผ่าน `@napi-rs/canvas`)
