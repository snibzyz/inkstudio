export function StatusBar({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-vscode-border bg-vscode-statusbar px-3 text-[11px] text-white">
      {children ?? <span>พร้อมใช้งาน</span>}
    </footer>
  )
}
