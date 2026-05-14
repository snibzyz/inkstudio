/**
 * setiIconResolver.ts — VS Code Seti icon theme (bundled locally)
 *
 * Lookup chain per file:
 *   1. fileNames  (exact name, e.g. "readme.md" → info icon)
 *   2. fileExtensions (special-cased extensions, e.g. "babelrc", "toml")
 *   3. EXT_TO_LANG → languageIds  (main language icons: .ts, .md, .json, etc.)
 *   4. default icon
 *
 * The Seti JSON only defines folder/folder-open in VS Code's internal CSS, not
 * in the JSON itself — use getSetiFolder() which returns a Codicon + color.
 */

import setiTheme from '../data/seti-icon-theme.json'

interface IconDef { fontCharacter: string; fontColor?: string }

interface SetiTheme {
  iconDefinitions: Record<string, IconDef>
  file: string
  fileExtensions: Record<string, string>
  fileNames: Record<string, string>
  languageIds: Record<string, string>
}

const theme = setiTheme as SetiTheme
const DEFAULT_COLOR = '#d4d7d6'

/** Convert JSON escape "\\E099" → actual Unicode character */
function toChar(def: IconDef): string {
  return String.fromCharCode(parseInt(def.fontCharacter.replace(/^\\/, ''), 16))
}

export interface SetiIcon {
  char: string
  color: string
}

function byId(iconId: string): SetiIcon {
  const def = theme.iconDefinitions[iconId]
  if (!def) return { char: toChar(theme.iconDefinitions[theme.file]), color: DEFAULT_COLOR }
  return { char: toChar(def), color: def.fontColor ?? DEFAULT_COLOR }
}

/**
 * File extension → VS Code languageId
 * Covers extensions that aren't in Seti's fileExtensions but ARE in languageIds.
 */
const EXT_TO_LANG: Record<string, string> = {
  // TypeScript / JavaScript
  ts: 'typescript', cts: 'typescript', mts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript', cjs: 'javascript', mjs: 'javascript',
  jsx: 'javascriptreact',
  // Data / config
  json: 'json', jsonc: 'jsonc', jsonl: 'jsonl',
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml',       // → _config via fileExtensions (kept here as backup)
  ini: 'properties', cfg: 'properties', conf: 'properties',
  env: 'dotenv', envlocal: 'dotenv',
  // Markup / doc
  md: 'markdown', markdown: 'markdown', mdown: 'markdown',
  mkd: 'markdown', mkdn: 'markdown', mdwn: 'markdown', mdx: 'markdown',
  html: 'html', htm: 'html', xhtml: 'html',
  xml: 'xml', xsl: 'xml', xslt: 'xml', svg: 'xml',
  css: 'css', postcss: 'postcss',
  less: 'less',
  scss: 'scss', sass: 'scss',
  // Systems / scripts
  sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript',
  ksh: 'shellscript', csh: 'shellscript', fish: 'shellscript',
  bat: 'bat', cmd: 'bat',
  ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
  // Compiled languages
  c: 'c',
  h: 'c',
  cpp: 'cpp', cxx: 'cpp', cc: 'cpp',
  hh: 'cpp', hpp: 'cpp', hxx: 'cpp',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin', kts: 'kotlin',
  swift: 'swift',
  go: 'go',
  rs: 'rust',
  py: 'python', pyw: 'python',
  rb: 'ruby',
  php: 'php',
  fs: 'fsharp', fsi: 'fsharp', fsx: 'fsharp',
  dart: 'dart',
  r: 'r', rmd: 'markdown',
  lua: 'lua',
  sql: 'sql',
  // Frontend frameworks
  vue: 'vue',
  svelte: 'svelte',
  // Other
  tf: 'terraform', tfvars: 'terraform',
  graphql: 'graphql', gql: 'graphql',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  tex: 'latex', ltx: 'latex',
  julia: 'julia',
  elm: 'elm',
  ex: 'elixir', exs: 'elixir',
  hs: 'haskell', lhs: 'haskell',
  clj: 'clojure', cljs: 'clojure', cljc: 'clojure',
  scm: 'scheme', rkt: 'scheme',
  ml: 'ocaml', mli: 'ocaml',
  coffee: 'coffeescript',
  haml: 'haml',
  njk: 'nunjucks',
  jinja: 'jinja', jinja2: 'jinja', j2: 'jinja',
  mustache: 'mustache', hbs: 'handlebars',
  styl: 'stylus',
  pug: 'jade',
  // Git
  gitignore: 'ignore', gitattributes: 'ignore', gitmodules: 'ignore',
}

/** Get Seti icon for a file */
export function getSetiIconForFile(fileName: string): SetiIcon {
  const lower = fileName.toLowerCase()

  // 1. Exact filename
  const byName = theme.fileNames[lower]
  if (byName) return byId(byName)

  // 2. Special extension mapping (Seti fileExtensions)
  const dotIdx = lower.indexOf('.')
  if (dotIdx >= 0) {
    const fullExt = lower.slice(dotIdx + 1)
    const byExt = theme.fileExtensions[fullExt]
    if (byExt) return byId(byExt)
    // Last segment only (e.g. "spec.ts" → "ts")
    const lastExt = lower.slice(lower.lastIndexOf('.') + 1)
    if (lastExt !== fullExt) {
      const byLast = theme.fileExtensions[lastExt]
      if (byLast) return byId(byLast)
    }
    // 3. languageId via extension
    const lang = EXT_TO_LANG[fullExt] ?? EXT_TO_LANG[lastExt]
    if (lang) {
      const byLang = theme.languageIds[lang]
      if (byLang) return byId(byLang)
    }
  }

  return byId(theme.file)
}
