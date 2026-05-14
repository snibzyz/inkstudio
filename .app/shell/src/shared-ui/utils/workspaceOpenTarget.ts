export type WorkspaceOpenTarget = {
  line: number | null
  column: number | null
  endColumn: number | null
  matchKey?: string | null
}

export function normalizeWorkspaceOpenTarget(
  target?: number | Partial<WorkspaceOpenTarget> | null
): WorkspaceOpenTarget | null {
  if (target == null) return null
  if (typeof target === 'number') {
    if (!Number.isFinite(target) || target < 1) return null
    return { line: Math.floor(target), column: null, endColumn: null, matchKey: null }
  }

  const line =
    typeof target.line === 'number' && Number.isFinite(target.line) && target.line > 0
      ? Math.floor(target.line)
      : null
  const column =
    typeof target.column === 'number' && Number.isFinite(target.column) && target.column > 0
      ? Math.floor(target.column)
      : null
  const endColumn =
    typeof target.endColumn === 'number' && Number.isFinite(target.endColumn) && target.endColumn > 0
      ? Math.floor(target.endColumn)
      : null

  if (line == null) return null
  return {
    line,
    column,
    endColumn: endColumn != null && endColumn >= (column ?? 1) ? endColumn : null,
    matchKey: typeof target.matchKey === 'string' && target.matchKey.trim() ? target.matchKey : null,
  }
}
