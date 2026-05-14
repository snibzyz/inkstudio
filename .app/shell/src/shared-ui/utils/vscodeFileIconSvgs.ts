/**
 * vscodeFileIconSvgs.ts — inline SVG bundle (vscode-icons-style) for Explorer
 *
 * Strategy:
 * - Inline SVG strings (no network, no asset path; works in dev/prod identically across OS)
 * - 16×16 viewBox; flat shapes + optional letter badge
 * - Each icon < 300 bytes; total bundle ≈ 9–12 KB gzipped
 *
 * Coverage: top file types by usage in INKIDEA. Anything not here falls back to
 * the codicon glyph in `explorerFileIcons.ts`.
 *
 * Maintenance: add a new entry here + map an extension/name to it in
 * `vscodeFileIconResolver.ts`. Do not import this directly from components —
 * always call `getFileIconSvgUrl()` through the resolver.
 */

/** badge icon factory — flat rounded square + bold label letters */
function badge(color: string, label: string, labelColor = '#fff'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="13" rx="2" fill="${color}"/><text x="8" y="11" text-anchor="middle" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="6" font-weight="700" fill="${labelColor}">${label}</text></svg>`
}

/** disc icon factory — circle with letter (used for languages with circular logos) */
function disc(color: string, label: string, labelColor = '#fff'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="${color}"/><text x="8" y="11" text-anchor="middle" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="7" font-weight="700" fill="${labelColor}">${label}</text></svg>`
}

export const FILE_ICON_SVGS: Record<string, string> = {
  // ---------- Generic ----------
  /** Plain paper-with-fold for unknown types */
  default_file: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 1.5h6l4 4V14a.5.5 0 01-.5.5h-9A.5.5 0 013 14z" fill="#c5c5c5"/><path d="M9 1.5v4h4" fill="#a0a0a0"/></svg>`,

  // ---------- Folders (gold, vscode-icons palette) ----------
  default_folder: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><path d="M1 4.5h4.5l1.5 1.5H15v.7H1z" fill="#c9a36e"/></svg>`,

  default_folder_opened: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v1.2H1z" fill="#c9a36e"/><path d="M1.3 7.2h13.4L13.2 13.5a.5.5 0 01-.5.4H2.8a.5.5 0 01-.5-.4z" fill="#dcb67a"/></svg>`,

  // ---------- Special folders (icon overlays for common dirs) ----------
  folder_git: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><circle cx="8" cy="10" r="3" fill="#f05033"/><path d="M8 7v6M5 10h6" stroke="#fff" stroke-width="0.7"/></svg>`,

  folder_git_opened: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v1.2H1z" fill="#c9a36e"/><path d="M1.3 7.2h13.4L13.2 13.5a.5.5 0 01-.5.4H2.8a.5.5 0 01-.5-.4z" fill="#dcb67a"/><circle cx="8" cy="11" r="2.4" fill="#f05033"/></svg>`,

  folder_node: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><circle cx="8" cy="10" r="3" fill="#83cd29"/></svg>`,

  folder_src: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><path d="M5 9.5l-1.3 1.3 1.3 1.3M11 9.5l1.3 1.3-1.3 1.3M9 8.5l-2 5" stroke="#3178c6" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`,

  folder_public: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><circle cx="8" cy="10.5" r="2.6" fill="none" stroke="#3178c6" stroke-width="0.9"/><path d="M5.4 10.5h5.2M8 7.9c1 1.5 1 3.8 0 5.2M8 7.9c-1 1.5-1 3.8 0 5.2" stroke="#3178c6" stroke-width="0.7" fill="none"/></svg>`,

  folder_dist: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><path d="M5 8.5l3 1.5 3-1.5M5 8.5v3l3 1.5M11 8.5v3l-3 1.5" stroke="#519aba" stroke-width="0.8" fill="none" stroke-linejoin="round"/></svg>`,

  folder_test: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M1 4.5h4.5l1.5 1.5H15v7.5a.5.5 0 01-.5.5H1.5a.5.5 0 01-.5-.5z" fill="#dcb67a"/><path d="M6 8.5h4M7 8.5v3l-1 1.5h4l-1-1.5v-3" stroke="#cbcb41" stroke-width="0.8" fill="none" stroke-linejoin="round"/></svg>`,

  // ---------- Languages ----------
  typescript: badge('#3178c6', 'TS'),
  typescript_react: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="13" rx="2" fill="#3178c6"/><ellipse cx="8" cy="8" rx="3.6" ry="1.4" fill="none" stroke="#61dafb" stroke-width="0.6"/><ellipse cx="8" cy="8" rx="3.6" ry="1.4" fill="none" stroke="#61dafb" stroke-width="0.6" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="3.6" ry="1.4" fill="none" stroke="#61dafb" stroke-width="0.6" transform="rotate(-60 8 8)"/><circle cx="8" cy="8" r="0.7" fill="#61dafb"/></svg>`,
  javascript: badge('#f7df1e', 'JS', '#000'),
  javascript_react: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="13" rx="2" fill="#20232a"/><ellipse cx="8" cy="8" rx="4.2" ry="1.6" fill="none" stroke="#61dafb" stroke-width="0.7"/><ellipse cx="8" cy="8" rx="4.2" ry="1.6" fill="none" stroke="#61dafb" stroke-width="0.7" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="4.2" ry="1.6" fill="none" stroke="#61dafb" stroke-width="0.7" transform="rotate(-60 8 8)"/><circle cx="8" cy="8" r="0.85" fill="#61dafb"/></svg>`,
  json: badge('#cbcb41', '{ }', '#000'),
  markdown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="2.5" width="14" height="11" rx="1.4" fill="none" stroke="#519aba" stroke-width="0.9"/><path d="M3.4 11V5l1.6 2 1.6-2v6M9 5v4M9 9l1-1.2M9 9l-1-1.2M11.5 5v6h2" stroke="#519aba" stroke-width="0.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 1.5h6l4 4V14a.5.5 0 01-.5.5h-9A.5.5 0 013 14z" fill="#c5c5c5"/><path d="M9 1.5v4h4" fill="#a0a0a0"/><path d="M5 8h6M5 10h6M5 12h4" stroke="#666" stroke-width="0.6"/></svg>`,
  yaml: badge('#cb171e', 'YML'),
  toml: badge('#9c4221', 'TOML'),
  ini: badge('#6d6d6d', 'INI'),
  css: badge('#1572b6', 'CSS'),
  scss: badge('#c6538c', 'SASS'),
  html: badge('#e34c26', 'HTML'),
  xml: badge('#a074c4', 'XML'),
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="13" rx="2" fill="#ffb13b"/><text x="8" y="11" text-anchor="middle" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="5.5" font-weight="700" fill="#fff">SVG</text></svg>`,
  python: disc('#3776ab', 'Py'),
  go: disc('#00add8', 'Go'),
  rust: disc('#dea584', 'Rs', '#000'),
  java: disc('#cc3e44', 'Jv'),
  ruby: disc('#cc342d', 'Rb'),
  php: disc('#777bb4', 'Php'),
  shell: badge('#4eaa25', 'SH'),
  powershell: badge('#012456', 'PS1'),
  batch: badge('#c1f12e', 'BAT', '#000'),
  sql: badge('#f29111', 'SQL'),
  graphql: badge('#e535ab', 'GQL'),

  // ---------- Media ----------
  image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.2" fill="none" stroke="#a074c4" stroke-width="0.9"/><circle cx="5" cy="6.5" r="1.2" fill="#a074c4"/><path d="M2 11l3.5-3 2.5 2L11 6.5l3.5 4.5" stroke="#a074c4" stroke-width="0.9" fill="none"/></svg>`,
  video: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" rx="1.2" fill="#9c4221"/><path d="M6.5 6L11 8 6.5 10z" fill="#fff"/></svg>`,
  audio: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M5 11V6l6-1.5v5" fill="none" stroke="#519aba" stroke-width="1"/><circle cx="4" cy="11" r="1.6" fill="#519aba"/><circle cx="10" cy="9.5" r="1.6" fill="#519aba"/></svg>`,
  pdf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 1.5h6l4 4V14a.5.5 0 01-.5.5h-9A.5.5 0 013 14z" fill="#fff"/><path d="M9 1.5v4h4" fill="#e5e5e5"/><rect x="3.5" y="9" width="9" height="3.5" rx="0.4" fill="#c9404e"/><text x="8" y="11.5" text-anchor="middle" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="2.6" font-weight="700" fill="#fff">PDF</text></svg>`,
  zip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 1.5h6l4 4V14a.5.5 0 01-.5.5h-9A.5.5 0 013 14z" fill="#cbcb41"/><path d="M9 1.5v4h4" fill="#999"/><path d="M7.5 5v6.5h1V5z" fill="#7a7a00"/><rect x="7.2" y="11" width="1.6" height="2" rx="0.2" fill="#7a7a00"/></svg>`,
  font: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="13" rx="2" fill="#a074c4"/><text x="8" y="12" text-anchor="middle" font-family="Georgia,serif" font-size="10" font-weight="700" fill="#fff">A</text></svg>`,

  // ---------- Config / lock / data ----------
  lock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M5 7V5a3 3 0 116 0v2" fill="none" stroke="#e6d460" stroke-width="0.9"/><rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="#e6d460"/><circle cx="8" cy="10" r="0.9" fill="#000"/></svg>`,
  config: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2" fill="none" stroke="#858585" stroke-width="1"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="#858585" stroke-width="0.9"/></svg>`,
  database: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" fill="#519aba"/><path d="M2.5 3.5v9c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8v-9" fill="#519aba"/><ellipse cx="8" cy="3.5" rx="5.5" ry="1.8" fill="none" stroke="#3a7a93" stroke-width="0.6"/><path d="M2.5 7c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8M2.5 10.5c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8" fill="none" stroke="#3a7a93" stroke-width="0.6"/></svg>`,
  log: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 1.5h6l4 4V14a.5.5 0 01-.5.5h-9A.5.5 0 013 14z" fill="#c5c5c5"/><path d="M9 1.5v4h4" fill="#a0a0a0"/><path d="M5 8h2M8 8h3M5 10h4M5 12h6" stroke="#519aba" stroke-width="0.7"/></svg>`,
  csv: badge('#3a7a3a', 'CSV'),
  excel: badge('#1d6f42', 'XLS'),
  word: badge('#2b579a', 'DOC'),
  binary: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="1.4" fill="#444"/><text x="8" y="11" text-anchor="middle" font-family="Consolas,monospace" font-size="6" font-weight="700" fill="#0f0">10</text></svg>`,
  git: badge('#f05033', 'Git'),
  docker: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="6" width="2.5" height="2.5" fill="#0db7ed"/><rect x="4" y="6" width="2.5" height="2.5" fill="#0db7ed"/><rect x="7" y="6" width="2.5" height="2.5" fill="#0db7ed"/><rect x="4" y="3.4" width="2.5" height="2.5" fill="#0db7ed"/><rect x="7" y="3.4" width="2.5" height="2.5" fill="#0db7ed"/><path d="M0.5 9c1 2.5 5 3.5 11 1.5l3-1c0 2.5-3 3.5-7 3.5-3 0-6.5-1-7-4z" fill="#0db7ed"/></svg>`,
}

/** Convert raw SVG string to a `data:` URL safe for `<img src>` (UTF-8 percent-encoded). */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
