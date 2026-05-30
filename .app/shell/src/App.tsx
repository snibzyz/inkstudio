import { Sidebar } from './shell/Sidebar'
import { StatusBar } from './shell/StatusBar'
import { UpdateBanner } from './components/UpdateBanner'
import { useApp } from './state/useApp'
import { CoverModule } from './features/cover'
import { RenderModule } from './features/render'
import { cn } from './ui'

export default function App() {
  const active = useApp((s) => s.activeModule)

  // Both modules stay mounted; we toggle visibility instead of unmounting. Unmounting
  // disposed the cover's fabric canvas (losing all artwork) and dropped the render tab's
  // selected folders. `programActive` tells each module whether it is the foreground tab
  // so keyboard handlers / job lifecycle only react for the visible one.
  return (
    <div className="flex h-screen flex-col bg-vscode-editor text-vscode-fg">
      <UpdateBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className={cn('h-full min-h-0 min-w-0', active === 'cover' ? 'block' : 'hidden')}>
            <CoverModule programActive={active === 'cover'} />
          </div>
          <div className={cn('h-full min-h-0 min-w-0', active === 'render' ? 'block' : 'hidden')}>
            <RenderModule programActive={active === 'render'} />
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
