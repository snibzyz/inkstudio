import { Sidebar } from './shell/Sidebar'
import { StatusBar } from './shell/StatusBar'
import { useApp } from './state/useApp'
import { CoverModule } from './features/cover'
import { RenderModule } from './features/render'

export default function App() {
  const active = useApp((s) => s.activeModule)

  return (
    <div className="flex h-screen flex-col bg-vscode-editor text-vscode-fg">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {active === 'cover' ? <CoverModule /> : null}
          {active === 'render' ? <RenderModule /> : null}
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
