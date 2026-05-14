/**
 * vscodeFileIconResolver.ts — file/folder name → SVG icon URL
 *
 * Acts as the bridge between Explorer rows and the inline SVG bundle in
 * `vscodeFileIconSvgs.ts`. The resolver returns a data URL for an `<img>` tag
 * when a match is found, or `null` to signal the caller should fall back to
 * the codicon glyph (legacy theme).
 */

import { FILE_ICON_SVGS, svgToDataUri } from './vscodeFileIconSvgs'

const EXT_TO_KEY: Record<string, keyof typeof FILE_ICON_SVGS> = {
  // TypeScript
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.d.ts': 'typescript',
  '.tsx': 'typescript_react',
  // JavaScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript_react',
  // Data
  '.json': 'json',
  '.jsonc': 'json',
  '.jsonl': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  // Docs
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
  '.rtf': 'text',
  '.log': 'log',
  // Web
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'css',
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',
  '.xml': 'xml',
  '.svg': 'svg',
  // Languages
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'java',
  '.kts': 'java',
  '.rb': 'ruby',
  '.erb': 'ruby',
  '.gemspec': 'ruby',
  '.php': 'php',
  '.phtml': 'php',
  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  // Database
  '.sql': 'database',
  '.db': 'database',
  '.sqlite': 'database',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  // Media
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.ico': 'image',
  '.avif': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.flac': 'audio',
  '.m4a': 'audio',
  // Archive
  '.zip': 'zip',
  '.tar': 'zip',
  '.gz': 'zip',
  '.7z': 'zip',
  '.rar': 'zip',
  '.bz2': 'zip',
  '.xz': 'zip',
  // Font
  '.ttf': 'font',
  '.otf': 'font',
  '.woff': 'font',
  '.woff2': 'font',
  '.eot': 'font',
  // Document / table
  '.pdf': 'pdf',
  '.csv': 'csv',
  '.tsv': 'csv',
  '.xlsx': 'excel',
  '.xls': 'excel',
  '.docx': 'word',
  '.doc': 'word',
  // Binary / system
  '.exe': 'binary',
  '.dll': 'binary',
  '.so': 'binary',
  '.dylib': 'binary',
  '.wasm': 'binary',
}

const NAME_TO_KEY: Record<string, keyof typeof FILE_ICON_SVGS> = {
  'package.json': 'json',
  'package-lock.json': 'json',
  'tsconfig.json': 'typescript',
  'tsconfig.build.json': 'typescript',
  'tsconfig.node.json': 'typescript',
  'jsconfig.json': 'json',
  'pnpm-lock.yaml': 'lock',
  'yarn.lock': 'lock',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.gitkeep': 'git',
  'dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  '.dockerignore': 'docker',
  '.env': 'lock',
  '.env.local': 'lock',
  '.env.example': 'lock',
  '.env.development': 'lock',
  '.env.production': 'lock',
  'license': 'config',
  'license.md': 'config',
  'license.txt': 'config',
}

/** ชื่อ folder พิเศษ → key ใน FILE_ICON_SVGS (ตัวเลือก closed/open แยกกัน) */
const FOLDER_NAME_TO_KEY: Record<string, { closed: keyof typeof FILE_ICON_SVGS; opened: keyof typeof FILE_ICON_SVGS }> = {
  '.git': { closed: 'folder_git', opened: 'folder_git_opened' },
  'node_modules': { closed: 'folder_node', opened: 'default_folder_opened' },
  'src': { closed: 'folder_src', opened: 'default_folder_opened' },
  'sources': { closed: 'folder_src', opened: 'default_folder_opened' },
  'public': { closed: 'folder_public', opened: 'default_folder_opened' },
  'static': { closed: 'folder_public', opened: 'default_folder_opened' },
  'dist': { closed: 'folder_dist', opened: 'default_folder_opened' },
  'build': { closed: 'folder_dist', opened: 'default_folder_opened' },
  'out': { closed: 'folder_dist', opened: 'default_folder_opened' },
  'tests': { closed: 'folder_test', opened: 'default_folder_opened' },
  'test': { closed: 'folder_test', opened: 'default_folder_opened' },
  '__tests__': { closed: 'folder_test', opened: 'default_folder_opened' },
  '__test__': { closed: 'folder_test', opened: 'default_folder_opened' },
  'spec': { closed: 'folder_test', opened: 'default_folder_opened' },
}

function lookupExtKey(lower: string): keyof typeof FILE_ICON_SVGS | null {
  // double extension first (.d.ts)
  for (const ext of ['.d.ts']) {
    if (lower.endsWith(ext)) return EXT_TO_KEY[ext] ?? null
  }
  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = lower.slice(dot)
  return EXT_TO_KEY[ext] ?? null
}

/** หา data-URL ของ SVG icon สำหรับ file หนึ่งชื่อ; null = ไม่มี SVG ให้ใช้ codicon fallback */
export function getFileIconSvgUrl(fileName: string): string | null {
  const lower = fileName.toLowerCase()
  const byName = NAME_TO_KEY[lower]
  if (byName) return svgToDataUri(FILE_ICON_SVGS[byName])
  const byExt = lookupExtKey(lower)
  if (byExt) return svgToDataUri(FILE_ICON_SVGS[byExt])
  // generic fallback — paper-with-fold (ไม่ดึงไอคอนเฉพาะ ใช้สีกลาง)
  return svgToDataUri(FILE_ICON_SVGS.default_file)
}

/** หา data-URL ของ SVG icon สำหรับ folder; รองรับ open/closed + folder พิเศษ */
export function getFolderIconSvgUrl(folderName: string, isOpen: boolean): string {
  const lower = folderName.toLowerCase()
  const special = FOLDER_NAME_TO_KEY[lower]
  if (special) {
    const key = isOpen ? special.opened : special.closed
    return svgToDataUri(FILE_ICON_SVGS[key])
  }
  const key = isOpen ? 'default_folder_opened' : 'default_folder'
  return svgToDataUri(FILE_ICON_SVGS[key])
}

/** ใช้ใน test: คืน key ดิบโดยไม่แปลงเป็น data URI */
export function _resolveFileIconKey(fileName: string): keyof typeof FILE_ICON_SVGS | null {
  const lower = fileName.toLowerCase()
  const byName = NAME_TO_KEY[lower]
  if (byName) return byName
  return lookupExtKey(lower)
}

export function _resolveFolderIconKey(folderName: string, isOpen: boolean): keyof typeof FILE_ICON_SVGS {
  const lower = folderName.toLowerCase()
  const special = FOLDER_NAME_TO_KEY[lower]
  if (special) return isOpen ? special.opened : special.closed
  return isOpen ? 'default_folder_opened' : 'default_folder'
}
