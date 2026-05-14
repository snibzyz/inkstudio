/**
 * fileIconVectors.ts — bridge to `file-icon-vectors` (vivid theme)
 *
 * Library: 363 file-extension SVGs by Daniel M. Hendricks (MIT).
 * The actual CSS is imported in `styles/vendor-file-icons.css`.
 *
 * This module decides which extension/filename matches a known icon,
 * and returns the CSS class string ("fiv-viv fiv-icon-XXX"). Returns null
 * when no match — caller should fall back to inline SVG via the
 * `vscodeFileIconResolver`.
 */

const SUPPORTED_EXTS: ReadonlySet<string> = new Set([
  '3g2','3ga','3gp','7z','aa','aac','ac','accdb','accdt','adn','ai','aif','aifc','aiff','ait','amr','ani','apk','app','applescript','asax','asc','ascx','asf','ash','ashx','asmx','asp','aspx','asx','au','aup','avi','axd','aze',
  'bak','bash','bat','bin','blank','bmp','bowerrc','bpg','browser','bz2',
  'c','cab','cad','caf','cal','cd','cer','cfg','cfm','cfml','cgi','class','cmd','codekit','coffee','coffeelintignore','com','compile','conf','config','cpp','cptx','cr2','crdownload','crt','crypt','cs','csh','cson','csproj','css','csv','cue',
  'dat','db','dbf','deb','dgn','dist','diz','dll','dmg','dng','doc','docb','docm','docx','dot','dotm','dotx','download','dpj','ds_store','dtd','dwg','dxf',
  'editorconfig','el','enc','eot','eps','epub','eslintignore','exe',
  'f4v','fax','fb2','fla','flac','flv','folder',
  'gadget','gdp','gem','gif','gitattributes','gitignore','go','gpg','gz',
  'h','handlebars','hbs','heic','hs','hsl','htm','html',
  'ibooks','icns','ico','ics','idx','iff','ifo','image','img','in','indd','inf','ini','iso',
  'j2','jar','java','jpe','jpeg','jpg','js','json','jsp','jsx',
  'key','kf8','kmk','ksh','kup',
  'less','lex','licx','lisp','lit','lnk','lock','log','lua',
  'm','m2v','m3u','m3u8','m4','m4a','m4r','m4v','map','master','mc','md','mdb','mdf','me','mi','mid','midi','mk','mkv','mm','mo','mobi','mod','mov','mp2','mp3','mp4','mpa','mpd','mpe','mpeg','mpg','mpga','mpp','mpt','msi','msu',
  'nef','nes','nfo','nix','npmignore',
  'odb','ods','odt','ogg','ogv','ost','otf','ott','ova','ovf',
  'p12','p7b','pages','part','pcd','pdb','pdf','pem','pfx','pgp','ph','phar','php','pkg','pl','plist','pm','png','po','pom','pot','potx','pps','ppsx','ppt','pptm','pptx','prop','ps','ps1','psd','psp','pst','pub','py','pyc',
  'qt',
  'ra','ram','rar','raw','rb','rdf','resx','retry','rm','rom','rpm','rsa','rss','rtf','ru','rub',
  'sass','scss','sdf','sed','sh','sitemap','skin','sldm','sldx','sln','sol','sql','sqlite','step','stl','svg','swd','swf','swift','sys',
  'tar','tcsh','tex','tfignore','tga','tgz','tif','tiff','tmp','torrent','ts','tsv','ttf','twig','txt',
  'udf',
  'vb','vbproj','vbs','vcd','vcs','vdi','vdx','vmdk','vob','vscodeignore','vsd','vss','vst','vsx','vtx',
  'war','wav','wbk','webinfo','webm','webp','wma','wmf','wmv','woff','woff2','wps','wsf',
  'xaml','xcf','xlm','xls','xlsm','xlsx','xlt','xltm','xltx','xml','xpi','xps','xrb','xsd','xsl','xspf','xz',
  'yaml','yml',
  'z','zip','zsh',
])

/** ขยาย mapping: นามสกุลที่แอปใช้บ่อยซึ่งไม่มีใน library → ใช้ icon ตัวที่ใกล้เคียง */
const EXT_ALIAS: Record<string, string> = {
  // .tsx / .jsx / .mjs / .cjs ใช้ของ ts/js
  tsx: 'ts',
  mts: 'ts',
  cts: 'ts',
  mjs: 'js',
  cjs: 'js',
  // ภาษาที่ไม่อยู่ใน library
  rs: 'config', // Rust → ใช้ config-like
  toml: 'config',
  kt: 'java',
  kts: 'java',
  scala: 'java',
  jsonc: 'json',
  jsonl: 'json',
  mdx: 'md',
  markdown: 'md',
  // Web / build
  htmx: 'html',
  xhtml: 'html',
  postcss: 'css',
  vue: 'html',
  svelte: 'html',
  // Shell variants
  zshrc: 'zsh',
  bashrc: 'bash',
  // Misc
  env: 'gitignore', // .env-style files (we use lock visual via NAME_TO_KEY in resolver)
}

/** ชื่อไฟล์เฉพาะ → ext ใน library */
const NAME_TO_EXT: Record<string, string> = {
  '.gitignore': 'gitignore',
  '.gitattributes': 'gitattributes',
  '.npmignore': 'npmignore',
  '.bowerrc': 'bowerrc',
  '.eslintignore': 'eslintignore',
  '.editorconfig': 'editorconfig',
  '.dockerignore': 'config',
  '.vscodeignore': 'vscodeignore',
  '.tfignore': 'tfignore',
  '.coffeelintignore': 'coffeelintignore',
  'dockerfile': 'config',
  '.ds_store': 'ds_store',
}

/** คืน CSS class ของ file-icon-vectors สำหรับชื่อไฟล์; null = ไม่รู้จัก ใช้ fallback inline SVG */
export function getFileIconVectorClass(fileName: string): string | null {
  const lower = fileName.toLowerCase()

  // 1) ชื่อพิเศษเต็ม
  const named = NAME_TO_EXT[lower]
  if (named && SUPPORTED_EXTS.has(named)) return `fiv-viv fiv-icon-${named}`

  // 2) นามสกุลตรง
  const dot = lower.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = lower.slice(dot + 1)
  if (SUPPORTED_EXTS.has(ext)) return `fiv-viv fiv-icon-${ext}`

  // 3) alias
  const aliased = EXT_ALIAS[ext]
  if (aliased && SUPPORTED_EXTS.has(aliased)) return `fiv-viv fiv-icon-${aliased}`

  return null
}

/** คืน CSS class สำหรับโฟลเดอร์ — file-icon-vectors มีไอคอน `folder` เดียว (ไม่มี open) */
export function getFolderIconVectorClass(): string {
  return 'fiv-viv fiv-icon-folder'
}
