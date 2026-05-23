/** @type {import('tailwindcss').Config} */
// path = จาก <APP>/.app/shell/tailwind.config.js ขึ้นไปถึง Mega Project root → .shared/
//   normal layout: .app/shell/ → ../ ../ ../ ขึ้น 3 ชั้นถึง "Mega Project/"
//   worktree layout: .claude/worktrees/<id>/.app/shell/ → ขึ้น 6 ชั้น
// fallback ทดลองทั้งสอง — ใช้ได้ทั้ง main checkout + worktree
const path = require('node:path')
const fs = require('node:fs')

function resolveTokens() {
  const candidates = [
    '../../../.shared/tailwind/tokens.cjs',          // main checkout
    '../../../../../../.shared/tailwind/tokens.cjs', // worktree (.claude/worktrees/<id>/)
  ]
  for (const rel of candidates) {
    const abs = path.resolve(__dirname, rel)
    if (fs.existsSync(abs)) return require(abs)
  }
  throw new Error('Could not locate .shared/tailwind/tokens.cjs from ' + __dirname)
}

const inkTokens = resolveTokens()

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: inkTokens.themeExtend,
  },
  darkMode: 'class',
  plugins: [],
}
