/**
 * tailwind.tokens.cjs — VENDORED copy ของ Z:/Mega Project/.shared/tailwind/tokens.cjs
 *
 * ทำไมต้อง vendor: tailwind.config.js เดิม require `.shared/tailwind/tokens.cjs` ใน
 * workspace parent ซึ่งอยู่นอก git repo ของ INKSTUDIO → ตอน CI/clone เดี่ยว ๆ จะหา
 * ไม่เจอ build ล้ม (เหมือน src/shared-ui/ ที่ถูก copy เข้ารีโปแล้ว). ไฟล์นี้คือสำเนา
 * ให้ build ได้แบบ standalone.
 *
 * SYNC: ถ้าแก้ `.shared/tailwind/tokens.cjs` (source of truth ของตระกูล INK)
 *       ต้อง copy ค่าใหม่มาทับไฟล์นี้ด้วย. ใน workspace dev, tailwind.config.js จะใช้
 *       `.shared` ก่อน (ถ้ามี) — ไฟล์นี้เป็น fallback สำหรับ CI/clone เท่านั้น
 */

const themeExtend = {
  fontFamily: {
    sans: ['Tahoma', '"Segoe UI"', 'system-ui', 'sans-serif'],
    mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
  },
  borderRadius: {
    mac: '12px',
    'mac-sm': '8px',
    'mac-md': '12px',
    'mac-lg': '16px',
    'mac-xl': '20px',
  },
  boxShadow: {
    mac: '0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 8px 24px rgb(0 0 0 / 0.35)',
    'mac-sm': '0 1px 0 0 rgb(255 255 255 / 0.05) inset',
  },
  keyframes: {
    'progress-slide': {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(400%)' },
    },
    'ink-pulse': {
      '0%': { boxShadow: '0 0 0 0 rgb(245 158 11 / 0.75)', borderColor: 'rgb(245 158 11 / 0.85)' },
      '50%': { boxShadow: '0 0 0 4px rgb(245 158 11 / 0.32)', borderColor: 'rgb(245 158 11 / 0.95)' },
      '100%': { boxShadow: '0 0 0 0 rgb(245 158 11 / 0)', borderColor: 'rgb(245 158 11 / 0)' },
    },
  },
  animation: {
    'progress-slide': 'progress-slide 1.4s ease-in-out infinite',
    'ink-pulse': 'ink-pulse 1s ease-out 3',
  },
  colors: {
    /* INKREALM brand amber scale — สีหลักของตระกูล INK ทั้งหมด */
    brand: {
      50:  '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',   /* primary — ปุ่ม action หลัก */
      600: '#D97706',   /* hover state */
      700: '#B45309',
      800: '#92400E',
      900: '#78350F',
    },
    /* VS Code Dark+ Theme — chrome / surface / typography ทั้งหมด */
    vscode: {
      editor: 'rgb(30 30 30 / <alpha-value>)',              /* #1e1e1e */
      sidebar: 'rgb(24 24 24 / <alpha-value>)',             /* #181818 */
      titlebar: 'rgb(30 30 30 / <alpha-value>)',            /* #1e1e1e */
      surface: 'rgb(37 37 38 / <alpha-value>)',             /* #252526 */
      border: 'rgb(43 43 43 / <alpha-value>)',              /* #2b2b2b */
      muted: 'rgb(133 133 133 / <alpha-value>)',            /* #858585 */
      fg: 'rgb(204 204 204 / <alpha-value>)',               /* #cccccc */
      'fg-bright': 'rgb(224 224 224 / <alpha-value>)',      /* #e0e0e0 */
      'fg-dim': 'rgb(160 160 160 / <alpha-value>)',         /* #a0a0a0 */

      /* INKREALM brand (primary action ของ INK family) — amber */
      brand: 'rgb(245 158 11 / <alpha-value>)',             /* #F59E0B amber-500 */
      'brand-hover': 'rgb(217 119 6 / <alpha-value>)',      /* #D97706 amber-600 */
      'brand-dim': 'rgb(180 83 9 / <alpha-value>)',         /* #B45309 amber-700 */

      /* VS Code blue (action chrome/IDE-ish) */
      accent: 'rgb(14 99 156 / <alpha-value>)',             /* #0e639c */
      'accent-hover': 'rgb(17 119 187 / <alpha-value>)',    /* #1177bb */

      'list-hover': 'rgb(42 45 46 / <alpha-value>)',        /* #2a2d2e */
      'list-active': 'rgb(55 55 61 / <alpha-value>)',       /* #37373d */
      focus: 'rgb(0 127 212 / <alpha-value>)',              /* #007fd4 */

      input: 'rgb(49 49 49 / <alpha-value>)',               /* #313131 */
      'input-border': 'rgb(60 60 60 / <alpha-value>)',      /* #3c3c3c */
      button: 'rgb(58 61 65 / <alpha-value>)',              /* #3a3d41 */
      'button-hover': 'rgb(69 73 78 / <alpha-value>)',      /* #45494e */

      'section-header-bg': 'rgb(21 21 21 / <alpha-value>)',     /* #151515 */
      'section-header-border': 'rgb(43 43 43 / <alpha-value>)', /* #2b2b2b */

      /* Semantic status */
      error: 'rgb(244 135 113 / <alpha-value>)',            /* #f48771 */
      'error-bg': 'rgb(90 29 29 / <alpha-value>)',          /* #5a1d1d */
      warning: 'rgb(204 167 0 / <alpha-value>)',            /* #cca700 */
      'warning-bg': 'rgb(61 47 0 / <alpha-value>)',         /* #3d2f00 */
      info: 'rgb(55 148 255 / <alpha-value>)',              /* #3794ff */
      'info-bg': 'rgb(9 71 113 / <alpha-value>)',           /* #094771 */
      success: 'rgb(137 209 133 / <alpha-value>)',          /* #89d185 */
      statusbar: 'rgb(0 122 204 / <alpha-value>)',          /* #007acc */

      track: 'rgb(58 58 58 / <alpha-value>)',
      folder: 'rgb(220 182 122 / <alpha-value>)',           /* #dcb67a */
      'menu-sep': 'rgb(69 69 69 / <alpha-value>)',          /* #454545 */
      'window-close': 'rgb(196 43 28 / <alpha-value>)',     /* #c42b1c */
    },
  },
}

module.exports = { themeExtend }
