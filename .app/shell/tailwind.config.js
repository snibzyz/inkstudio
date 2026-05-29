/** @type {import('tailwindcss').Config} */
// path = จาก <APP>/.app/shell/tailwind.config.js ขึ้นไปถึง Mega Project root → .shared/
//   normal layout: .app/shell/ → ../ ../ ../ ขึ้น 3 ชั้นถึง "Mega Project/"
//   worktree layout: .claude/worktrees/<id>/.app/shell/ → ขึ้น 6 ชั้น
// fallback ทดลองทั้งสอง — ใช้ได้ทั้ง main checkout + worktree
const path = require('node:path')
const fs = require('node:fs')

function resolveTokens() {
  const candidates = [
    '../../../.shared/tailwind/tokens.cjs',          // workspace main checkout (source of truth)
    '../../../../../../.shared/tailwind/tokens.cjs', // workspace worktree (.claude/worktrees/<id>/)
    './tailwind.tokens.cjs',                         // vendored copy — CI / standalone git clone
  ]
  for (const rel of candidates) {
    const abs = path.resolve(__dirname, rel)
    if (fs.existsSync(abs)) return require(abs)
  }
  throw new Error('Could not locate tailwind tokens (.shared or vendored) from ' + __dirname)
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
