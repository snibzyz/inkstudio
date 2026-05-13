import { Codicon } from '../../ui'

export function PortStatusNotice({
  files,
  readmePath,
}: {
  files: string[]
  readmePath?: string
}) {
  return (
    <div className="rounded-sm border border-vscode-warning/40 bg-vscode-warning-bg/40 p-3 text-[11px] leading-relaxed text-vscode-fg-dim">
      <div className="mb-1 flex items-center gap-1.5 text-vscode-warning">
        <Codicon name="info" />
        <span className="font-semibold">ส่วนนี้ยังไม่พร้อมใช้งานจริง</span>
      </div>
      ต้อง port:{' '}
      {files.map((f, i) => (
        <span key={f}>
          {i > 0 ? ', ' : ''}
          <code className="rounded-sm bg-vscode-input/60 px-1">{f}</code>
        </span>
      ))}
      {readmePath ? (
        <>
          <br />
          อ่าน <code className="rounded-sm bg-vscode-input/60 px-1">{readmePath}</code> สำหรับแผนการ port
        </>
      ) : null}
    </div>
  )
}
