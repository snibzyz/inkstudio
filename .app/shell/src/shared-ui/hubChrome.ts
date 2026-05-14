import { cn } from './utils/cn'

/** แถบหัวฮับ / title bar — โทนเทา VS Code */
export const hubTitleBar = cn(
  'border-b border-vscode-border bg-vscode-titlebar text-vscode-fg backdrop-blur-md'
)

/** แถบบนสุดแบบ VS Code — เมนู + command area + ปุ่มหน้าต่าง */
export const hubTopMenuRow = cn(
  'grid h-10 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-vscode-border bg-[#181818] px-3'
)

/** ปุ่มเมนูแถวบนสุด */
export function hubMenuTextButton(active = false) {
  return cn(
    'inline-flex h-7 items-center rounded-sm px-2 text-[12px] font-medium transition-colors',
    active
      ? 'bg-vscode-list-active text-vscode-fg-bright'
      : 'text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg'
  )
}

/** command center กลางแถบบน */
export const hubCommandCenter = cn(
  'flex h-8 min-w-0 items-center gap-2 rounded-md border border-vscode-border bg-[#252526] px-3 text-[12px] text-vscode-fg-dim',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
)

/** ปุ่มควบคุมหน้าต่างโทน VS Code */
export function hubWindowControl(active = false) {
  return cn(
    'inline-flex h-9 w-[46px] items-center justify-center text-vscode-muted transition-colors',
    active
      ? 'bg-[#37373d] text-vscode-fg-bright'
      : 'hover:bg-vscode-list-hover hover:text-vscode-fg'
  )
}

/** ปุ่มสลับโหมดพื้นที่ทำงาน (แถบกลาง header) */
export function hubModeTab(active: boolean) {
  return cn(
    'inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-[12px]',
    active
      ? 'bg-[#2a2d2e] text-vscode-fg-bright shadow-[inset_0_-2px_0_0_rgb(0_122_204)]'
      : 'text-vscode-muted hover:bg-vscode-list-hover hover:text-vscode-fg'
  )
}

/** ช่องค้นหาแบบ toolbar */
export const hubSearchField = cn(
  'h-7 w-full rounded-[2px] border border-vscode-border bg-vscode-editor/90 pl-7 pr-2 text-[12px] text-vscode-fg',
  'placeholder:text-vscode-muted outline-none transition-[border-color,box-shadow,background-color]',
  'focus:border-vscode-focus focus:bg-vscode-editor focus:ring-1 focus:ring-vscode-focus/35'
)

/** ปุ่มขอบในแถบเครื่องมือ (เช่น รายงานบั๊ก) */
export const hubToolbarButton = cn(
  'inline-flex h-8 items-center gap-1.5 rounded-sm border border-vscode-border bg-transparent px-2.5 text-[12px] font-medium text-vscode-fg',
  'transition-colors hover:bg-vscode-list-hover hover:text-vscode-fg-bright',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focus/50'
)

/** พื้นหลัง shell ด้านใน (ลดไล่สีสัน เน้นเทา) */
export const hubAppShellBg = cn(
  'bg-vscode-editor bg-[linear-gradient(180deg,rgb(45,45,46)_0%,rgb(30,30,30)_50%,rgb(26,26,26)_100%)]'
)

/** ครอบ `IdeWorkspaceSurface` ใน Hub — ไม่มุม ไม่เงา โทน editor */
export const hubIdeSurface = cn(
  '!h-full !min-h-0 !rounded-none !border-0 !bg-vscode-editor !p-0 !shadow-none backdrop-blur-none'
)

/** แถบโปรเจกต์ที่ใช้งาน — สูงเท่าแถบเครื่องมือ VS Code */
export const hubActiveProjectStrip = cn(
  'flex h-9 shrink-0 items-center gap-3 border-b border-vscode-border bg-vscode-titlebar px-3'
)

/**
 * padding แนวนอน 12px — ให้ toolbar / ฟอร์ม / รายการจุดเริ่มต้นแนวตั้งตรงกันทุกแท็บ (ใต้แถบโปรเจกต์)
 */
export const hubIdeGutterX = 'px-3'

/**
 * ความกว้างคอลัมน์ Explorer ทุกแท็บ — ตั้งที่ `:root { --inkidea-hub-explorer-w }` ใน `index.css`
 * min 240px max ตามตัวแปร (ค่าเริ่ม 280px)
 */
/** ซ้าย IDE — บน `lg` กว้างเท่าตัวแปรทุกแท็บ (ค่าเริ่ม 280px) ไม่หดเป็น 279px จาก min(100%,…) */
export const hubIdeExplorerAside = cn(
  'box-border flex min-h-0 w-full min-w-0 shrink-0 flex-col border-r border-vscode-border bg-vscode-sidebar',
  'min-h-[180px]',
  'lg:min-h-0 lg:h-full lg:w-[var(--inkidea-hub-explorer-w,280px)] lg:min-w-[var(--inkidea-hub-explorer-w,280px)] lg:max-w-[var(--inkidea-hub-explorer-w,280px)] lg:flex-none'
)


/**
 * คอลัมน์ grid Explorer | sash | editor — คั่นกลางสำหรับ `HubIdeExplorerSash`
 * ใช้กับ `className={cn('grid grid-cols-1 min-h-0 flex-1 overflow-hidden', hubIdeSplitGridCols)}`
 */
export const hubIdeSplitGridCols =
  'lg:grid-cols-[minmax(240px,var(--inkidea-hub-explorer-w,280px))_5px_minmax(0,1fr)]'

/** คอลัมน์ซ้ายความกว้างคงที่ (รายการไฟล์ใน split ซ้อน) */
export const hubIdeExplorerColumnFixed = cn(
  'w-[var(--inkidea-hub-explorer-w,280px)] min-w-[240px] max-w-[var(--inkidea-hub-explorer-w,280px)] shrink-0'
)

/** แถบ well ของแท็บ (พื้นหลัง #252526 แบบ VS Code) — เลื่อนแนวนอนอย่างเดียว ไม่ wrap / ไม่มี scroll แนวตั้ง */
export const hubIdeTabsWell = cn(
  'inkidea-hub-tabs-well flex h-9 max-h-9 min-h-0 min-w-0 shrink-0 flex-nowrap items-stretch gap-px overflow-x-auto overflow-y-hidden border-b border-vscode-border bg-[#252526]',
  '[scrollbar-width:thin] [scrollbar-color:rgb(62_62_66)_transparent]'
)

/** แท็บที่เปิดอยู่ */
export const hubIdeTabActive = cn(
  'flex h-full min-h-0 min-w-0 max-w-[min(100%,480px)] shrink-0 items-center gap-2 border-t-2 border-t-vscode-focus bg-vscode-editor px-3 text-[12px] text-vscode-fg-bright'
)

/** แท็บที่เปิดค้างไว้แต่ไม่ active — แถบเดียวกับ VS Code */
export const hubIdeTabInactive = cn(
  'flex h-full min-h-0 min-w-0 max-w-[min(100%,220px)] shrink-0 items-center gap-1.5 border-t-2 border-t-transparent bg-[#2d2d2d] px-2.5 text-[12px] text-vscode-muted',
  'hover:bg-vscode-list-hover hover:text-vscode-fg'
)

/** ชื่อไฟล์บนแท็บ — แบบ workbench ของ VS Code/Cursor (sans 13px ไม่ใช่ monospace) */
export const hubIdeTabFileLabel =
  'min-w-0 flex-1 truncate text-left text-[13px] font-normal leading-tight text-inherit'

/** แถบ breadcrumb ใต้แท็บ — ไม่แย่ง stacking กับ overlay ของ Monaco */
export const hubIdeBreadcrumbBar = cn(
  'relative z-0 flex h-[22px] shrink-0 items-center border-b border-vscode-border bg-vscode-editor',
  hubIdeGutterX
)

/**
 * ครอบ Monaco ใต้ breadcrumb — `overflow-visible` ให้ find/hover ไม่ถูกตัด;
 * `z-10` + `isolate` ให้ overlay ภายในอยู่เหนือแถบด้านบนในกลุ่มเดียวกัน
 */
export const hubIdeMonacoEditorStack = cn(
  'relative z-10 isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-visible'
)

/** หัว Explorer / ป้ายโฟลเดอร์ — สูง 36px */
export const hubExplorerHeader = cn(
  'flex h-9 shrink-0 cursor-default items-center border-b border-vscode-border',
  hubIdeGutterX
)

/**
 * หัวมุมมอง sidebar แบบ VS Code (22px) — สีเดียวกันทุกแท็บ (Explorer / Search / Smart Copy / Kunpeng)
 * พื้นหลังแถบ #252526 บนพื้นรายการ #181818
 */
export const hubIdeSidebarSectionHeaderBar = cn(
  'inkidea-sidebar-section-header flex h-[22px] shrink-0 cursor-default items-center border-t border-[#2b2b2b] bg-[#252526] pl-3 pr-2 leading-[22px] text-[#cccccc]',
  'font-[system-ui,-apple-system,BlinkMacSystemFont,"Segoe_UI",sans-serif]'
)

/** แถบเครื่องมือโทน sidebar (เช่น เปลี่ยนโฟลเดอร์ workspace) */
export const hubIdeSidebarToolbar = cn(
  'flex h-9 shrink-0 flex-wrap items-center gap-2 border-b border-vscode-border bg-vscode-sidebar',
  hubIdeGutterX
)

/** หัว aside มีหัวข้อ + ปุ่ม (ไม่บังคับพื้นหลัง — รับจาก parent) */
export const hubIdeAsideHeaderRow = cn(
  'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-vscode-border',
  hubIdeGutterX
)

/** หัวรายการใน editor (ชื่อหมวด + meta) */
export const hubIdeEditorSectionHeader = cn(
  'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-vscode-border bg-vscode-editor',
  hubIdeGutterX
)

/** แถบชื่อไฟล์ / แท็บด้านบน editor (ไม่ใส่ z-index สูง — กัน Monaco hover/find โดนทับ) */
export const hubIdeEditorTabRow = cn(
  'flex h-9 shrink-0 items-center gap-2 border-b border-vscode-border bg-vscode-editor',
  hubIdeGutterX
)

/** แถบแท็บโทน titlebar (เช่น ดูไฟล์ต้นฉบับ) */
export const hubIdeEditorTabRowTitlebar = cn(
  'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-vscode-border bg-vscode-titlebar',
  hubIdeGutterX
)

/** บล็อกฟอร์มหรือคำอธิบายสั้นใต้แถบ */
export const hubIdeFormBlock = cn('shrink-0 border-b border-vscode-border py-2', hubIdeGutterX)

/** แถบสถานะว่าง / เตือน (ความสูงเทียบฟอร์ม) */
export const hubIdeStatusStrip = cn(
  'shrink-0 border-b border-vscode-border py-2 text-[12px]',
  hubIdeGutterX
)

/** แถบ titlebar สำหรับสร้างรายการแบบ inline */
export const hubIdeInlineCreateBar = cn(
  'flex min-h-9 shrink-0 items-center border-b border-vscode-border bg-vscode-titlebar py-1.5',
  hubIdeGutterX
)

/** footer บางใต้ split editor — แบบ VS Code statusbar */
export const hubIdeFooterBar =
  'box-border flex h-[22px] min-h-[22px] max-h-[22px] shrink-0 items-center justify-between border-t border-vscode-border bg-vscode-sidebar px-0 text-[12px] leading-none text-vscode-fg/85'

/** Item ใน statusbar (icon + text สั้น) — เลียน VS Code statusbar-item */
export function hubIdeStatusItem(extraClass?: string) {
  return cn(
    'inline-flex h-full items-center gap-1 px-2 text-[12px] leading-none transition-colors',
    'text-vscode-fg/85 hover:bg-white/10 hover:text-vscode-fg-bright',
    'focus:outline-none focus-visible:bg-white/10',
    extraClass
  )
}

/** Item แบบ readonly (ไม่มี hover) สำหรับข้อมูลแสดงเฉย ๆ */
export function hubIdeStatusInfo(extraClass?: string) {
  return cn(
    'inline-flex h-full items-center gap-1 px-2 text-[12px] leading-none text-vscode-fg/85',
    extraClass
  )
}

/** ไอคอนปุ่มในแถบ Explorer / IDE */
export function hubIdeIconBtn(className?: string) {
  return cn(
    'inline-flex h-7 w-7 items-center justify-center rounded-sm text-vscode-muted transition-colors',
    'hover:bg-vscode-list-hover hover:text-vscode-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focus/40',
    'disabled:pointer-events-none disabled:opacity-35',
    className
  )
}

/** อินพุตในพื้นที่ IDE (ใช้คู่กับ macInput ได้โดยต่อท้าย) */
export function vscodeInputField(...extra: (string | undefined | false)[]) {
  return cn(
    'rounded-sm border-vscode-border bg-vscode-input text-vscode-fg placeholder:text-vscode-muted',
    'focus:border-vscode-focus focus:ring-1 focus:ring-vscode-focus/35',
    ...extra.filter(Boolean)
  )
}

/** ข้อความปุ่มลัดชุดเดียวกับ VS Code (editor / Monaco) */
export const hubIdeEditorShortcutHint =
  'Ctrl+S บันทึก · Ctrl+F ค้นหา · Ctrl+H แทนที่ · Ctrl+W ปิดแท็บ · Ctrl+PgUp/PgDn สลับแท็บ · Ctrl+Shift+F ทั่วโปรเจกต์'
