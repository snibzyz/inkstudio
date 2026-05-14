/**
 * RenderTab — แท็บ "คลิป"
 *
 * Editor-tab surface แบบเดียวกับแท็บเสียง / ตรวจ:
 * - แท็บตรึง "ตั้งค่าคลิป" ปิดไม่ได้ — เนื้อหาอยู่ใน RenderSettingsPane (HubIdeSettingsShell)
 * - แท็บอื่น = ไฟล์เสียง / ภาพ / วิดีโอที่เปิดจาก Explorer ในโปรเจกต์ active
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cn,
  Codicon,
  HubIdeBreadcrumbBar,
  HubIdeEditorWatermark,
  hubIdeIconBtn,
  hubIdeMonacoEditorStack,
  hubIdeStatusStrip,
  hubIdeTabActive,
  hubIdeTabFileLabel,
  hubIdeTabInactive,
  hubIdeTabsWell,
} from '@shared/ui'
import { X } from 'lucide-react'
import { useHubWorkspace } from '@/state/useHubWorkspace'
import { useRender } from './useRender'
import { useRenderJob } from './useRenderJob'
import { RenderSettingsPane } from './RenderSettingsPane'

const PINNED_RENDER_SETTINGS_REL = 'inkidea://render/settings'
const PINNED_RENDER_SETTINGS_LABEL = 'ตั้งค่าคลิป'

const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'mkv', 'webm'])

type RenderMediaKind = 'audio' | 'image' | 'video' | 'unknown'

type RenderEditorTab = {
  rel: string
  name: string
  kind: RenderMediaKind
  loading: boolean
  dataUrl: string | null
  error: string | null
}

export type RenderTabProps = {
  programActive?: boolean
}

function makePinnedTab(): RenderEditorTab {
  return {
    rel: PINNED_RENDER_SETTINGS_REL,
    name: PINNED_RENDER_SETTINGS_LABEL,
    kind: 'unknown',
    loading: false,
    dataUrl: null,
    error: null,
  }
}

function isPinnedRenderTab(rel: string) {
  return rel === PINNED_RENDER_SETTINGS_REL
}

function fileNameFromRel(rel: string): string {
  const parts = rel.split(/[\\/]/u).filter(Boolean)
  return parts[parts.length - 1] ?? rel
}

function extFromRel(rel: string): string {
  const name = fileNameFromRel(rel)
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function mediaKindFromRel(rel: string): RenderMediaKind {
  const ext = extFromRel(rel)
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  return 'unknown'
}

function normalizeWorkspaceRel(rel: string): string {
  return rel.replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+/gu, '/')
}

function joinNativePath(root: string, rel: string): string {
  const cleanRoot = root.replace(/[\\/]+$/u, '')
  const cleanRel = normalizeWorkspaceRel(rel)
  const sep = cleanRoot.includes('\\') ? '\\' : '/'
  return `${cleanRoot}${sep}${cleanRel.replace(/\//gu, sep)}`
}

function dirnameNative(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(0, idx) : ''
}

function normalizeTabs(tabs: RenderEditorTab[]): RenderEditorTab[] {
  const pinned = tabs.find((t) => isPinnedRenderTab(t.rel)) ?? makePinnedTab()
  const rest = tabs.filter((t) => !isPinnedRenderTab(t.rel))
  return [pinned, ...rest]
}

function isRelInActiveProject(rel: string, projectRootRel: string | null): boolean {
  if (!projectRootRel) return false
  const n = normalizeWorkspaceRel(rel)
  const root = normalizeWorkspaceRel(projectRootRel).replace(/\/+$/u, '')
  return n === root || n.startsWith(`${root}/`)
}

export function RenderTab({ programActive = true }: RenderTabProps) {
  const activeProjectId = useHubWorkspace((s) => s.activeProjectId)
  const activeProject = useHubWorkspace((s) => s.activeProject)
  const workspaceRoot = useHubWorkspace((s) => s.workspaceRoot)
  const hydrate = useHubWorkspace((s) => s.hydrate)
  const workspaceOpenFilePath = useHubWorkspace((s) => s.workspaceOpenFilePath)
  const requestWorkspaceFileOpen = useHubWorkspace((s) => s.requestWorkspaceFileOpen)
  const requestExplorerReveal = useHubWorkspace((s) => s.requestExplorerReveal)
  const readWorkspaceFileAsDataUrl = useHubWorkspace((s) => s.readWorkspaceFileAsDataUrl)
  const setEditorTabCloseForMode = useHubWorkspace((s) => s.setEditorTabCloseForMode)
  const setEditorTabCycleForMode = useHubWorkspace((s) => s.setEditorTabCycleForMode)
  const hubWorkspaceActiveMode = useHubWorkspace((s) => s.hubWorkspaceActiveMode)
  const electronAvailable = typeof window !== 'undefined' && Boolean(window.electron?.ipc?.hubListProjects)

  const job = useRenderJob({ programActive })

  const [editorTabs, setEditorTabs] = useState<RenderEditorTab[]>([makePinnedTab()])
  const [activeRel, setActiveRel] = useState<string>(PINNED_RENDER_SETTINGS_REL)

  const activeRelRef = useRef(activeRel)
  activeRelRef.current = activeRel
  const tabsRef = useRef(editorTabs)
  tabsRef.current = editorTabs

  /** hydrate workspace ครั้งแรกถ้ายังไม่ได้ hydrate */
  useEffect(() => {
    if (!electronAvailable) return
    void hydrate()
  }, [electronAvailable, hydrate])

  /** sync กับ active project — apply path + reset queue/logs */
  useEffect(() => {
    const project = activeProject
    if (!project?.resolved || !project.id) {
      useRender.getState().resetForActiveProject(null, null)
      return
    }
    useRender.getState().resetForActiveProject(project.id, {
      audioRaw: project.resolved.audioRaw,
      audioProcessed: project.resolved.audioProcessed,
      renderOutput: project.resolved.renderOutput,
      covers: project.resolved.covers,
    })
    void job.refreshAudioPreview(project.resolved.audioRaw)
    /** intentional: ห้ามใส่ job ใน deps — useRenderJob คืน object ใหม่ทุก render */
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeProject, activeProjectId])

  /** ตอนสลับโปรเจกต์: รีเซ็ต tabs ให้เหลือแต่ pinned */
  useEffect(() => {
    setEditorTabs([makePinnedTab()])
    setActiveRel(PINNED_RENDER_SETTINGS_REL)
  }, [activeProjectId])

  const projectRootRel = useMemo(
    () => activeProject ? normalizeWorkspaceRel(activeProject.workspaceRelRoot ?? activeProject.slug ?? '') : null,
    [activeProject]
  )

  const orderedTabs = useMemo(() => normalizeTabs(editorTabs), [editorTabs])
  const activeTab = useMemo(() => editorTabs.find((t) => t.rel === activeRel) ?? null, [activeRel, editorTabs])

  const openOrFocusTab = useCallback(
    (rel: string) => {
      const normalizedRel = normalizeWorkspaceRel(rel)
      const kind = mediaKindFromRel(normalizedRel)
      if (kind === 'unknown') {
        setActiveRel(PINNED_RENDER_SETTINGS_REL)
        return false
      }

      const nativePath = workspaceRoot ? joinNativePath(workspaceRoot, normalizedRel) : ''
      if (kind === 'image' && nativePath) {
        useRender.getState().setImagePath(nativePath)
      } else if (kind === 'audio') {
        const audioName = fileNameFromRel(normalizedRel)
        if (nativePath) {
          const audioFolder = dirnameNative(nativePath)
          if (audioFolder) {
            useRender.getState().setAudioFolder(audioFolder)
            void job.refreshAudioPreview(audioFolder)
          }
        }
        useRender.getState().setSelectedAudioFiles((prev) => {
          const next = new Set(prev)
          next.add(audioName)
          return next
        })
      }

      setEditorTabs((prev) => {
        if (prev.some((t) => t.rel === normalizedRel)) return prev
        return normalizeTabs([
          ...prev,
          {
            rel: normalizedRel,
            name: fileNameFromRel(normalizedRel),
            kind,
            loading: true,
            dataUrl: null,
            error: null,
          },
        ])
      })
      setActiveRel(normalizedRel)
      return true
    },
    [job, workspaceRoot]
  )

  const removeTab = useCallback((rel: string): boolean => {
    if (isPinnedRenderTab(rel)) return false
    const tabs = tabsRef.current
    const index = tabs.findIndex((t) => t.rel === rel)
    if (index < 0) return false
    const nextTabs = normalizeTabs(tabs.filter((t) => t.rel !== rel))
    setEditorTabs(nextTabs)
    if (activeRelRef.current === rel) {
      const nextActive = nextTabs[Math.max(0, index - 1)]?.rel ?? PINNED_RENDER_SETTINGS_REL
      setActiveRel(nextActive)
    }
    return true
  }, [])

  useEffect(() => {
    if (!programActive) return
    setEditorTabCloseForMode('clip', () => removeTab(activeRelRef.current))
    return () => setEditorTabCloseForMode('clip', undefined)
  }, [programActive, removeTab, setEditorTabCloseForMode])

  const cycleTab = useCallback(
    (dir: 1 | -1): boolean => {
      if (orderedTabs.length <= 1) return false
      const order = orderedTabs.map((tab) => tab.rel)
      const index = order.indexOf(activeRelRef.current)
      const base = index < 0 ? 0 : index
      setActiveRel(order[(base + dir + order.length) % order.length])
      return true
    },
    [orderedTabs]
  )

  useEffect(() => {
    if (!programActive) return
    setEditorTabCycleForMode('clip', cycleTab)
    return () => setEditorTabCycleForMode('clip', undefined)
  }, [cycleTab, programActive, setEditorTabCycleForMode])

  /** โหลด preview data URL เมื่อเปิด media tab ใหม่ */
  useEffect(() => {
    if (!activeTab || isPinnedRenderTab(activeTab.rel) || !activeTab.loading) return
    let cancelled = false
    void readWorkspaceFileAsDataUrl(activeTab.rel)
      .then(({ dataUrl, missing }) => {
        if (cancelled) return
        setEditorTabs((prev) =>
          prev.map((t) =>
            t.rel === activeTab.rel
              ? {
                  ...t,
                  loading: false,
                  dataUrl: missing ? null : dataUrl,
                  error: missing ? 'ไม่พบไฟล์ในเวิร์กสเปซ' : null,
                }
              : t
          )
        )
      })
      .catch((e) => {
        if (cancelled) return
        setEditorTabs((prev) =>
          prev.map((t) =>
            t.rel === activeTab.rel
              ? {
                  ...t,
                  loading: false,
                  dataUrl: null,
                  error: e instanceof Error ? e.message : String(e),
                }
              : t
          )
        )
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, readWorkspaceFileAsDataUrl])

  /** รับ workspaceOpenFilePath จาก Explorer — เปิดเฉพาะไฟล์ media ในโปรเจกต์ active */
  useEffect(() => {
    if (!programActive || hubWorkspaceActiveMode !== 'clip') return
    const rel = workspaceOpenFilePath?.trim()
    if (!rel) return
    if (!isRelInActiveProject(rel, projectRootRel)) return
    const opened = openOrFocusTab(rel)
    if (opened) requestWorkspaceFileOpen(null)
  }, [
    hubWorkspaceActiveMode,
    openOrFocusTab,
    programActive,
    projectRootRel,
    requestWorkspaceFileOpen,
    workspaceOpenFilePath,
  ])

  const breadcrumbSegments = useMemo(() => {
    if (!activeRel || isPinnedRenderTab(activeRel)) {
      return [{ label: PINNED_RENDER_SETTINGS_LABEL, title: PINNED_RENDER_SETTINGS_REL }]
    }
    const parts = activeRel.split('/').filter(Boolean)
    return parts.map((label, i) => ({ label, title: parts.slice(0, i + 1).join('/') }))
  }, [activeRel])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-vscode-editor text-vscode-fg">
      {!activeProject ? (
        <div className={cn(hubIdeStatusStrip, 'bg-vscode-sidebar text-vscode-muted')}>
          กรุณาเลือกโปรเจกต์ก่อนใช้งานเครื่องมือคลิป
        </div>
      ) : null}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-vscode-editor">
        <div className={hubIdeTabsWell} role="tablist" aria-label="แท็บคลิป">
          {orderedTabs.map((tab) => {
            const isActive = tab.rel === activeRel
            const pinned = isPinnedRenderTab(tab.rel)
            return (
              <div
                key={tab.rel}
                role="tab"
                aria-selected={isActive}
                className={isActive ? hubIdeTabActive : hubIdeTabInactive}
              >
                <button
                  type="button"
                  className={hubIdeTabFileLabel}
                  title={tab.rel}
                  onClick={() => setActiveRel(tab.rel)}
                >
                  {tab.name}
                </button>
                {pinned ? null : (
                  <button
                    type="button"
                    className={hubIdeIconBtn('h-6 w-6 shrink-0')}
                    title="ปิดแท็บ"
                    aria-label={`ปิด ${tab.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTab(tab.rel)
                    }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <HubIdeBreadcrumbBar segments={breadcrumbSegments} />

        <div className={hubIdeMonacoEditorStack}>
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1',
              activeTab && isPinnedRenderTab(activeTab.rel) ? '' : 'hidden'
            )}
            aria-hidden={!(activeTab && isPinnedRenderTab(activeTab.rel))}
          >
            <RenderSettingsPane job={job} />
          </div>

          {!activeTab ? (
            <HubIdeEditorWatermark
              title="ยังไม่มีแท็บที่เปิดอยู่"
              hint='แท็บ "ตั้งค่าคลิป" ถูกตรึงไว้แล้ว'
            />
          ) : isPinnedRenderTab(activeTab.rel) ? null : activeTab.loading ? (
            <div className="flex h-full min-h-[120px] items-center justify-center text-vscode-muted">
              <Codicon name="loading" spin />
            </div>
          ) : activeTab.error ? (
            <HubIdeEditorWatermark title="เปิดไฟล์ไม่ได้" hint={activeTab.error} />
          ) : activeTab.kind === 'image' && activeTab.dataUrl ? (
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-vscode-editor">
              <div className="flex items-center justify-between border-b border-vscode-border bg-vscode-sidebar px-3 py-2 text-[12px]">
                <span className="truncate text-vscode-fg-dim" title={activeTab.rel}>{activeTab.rel}</span>
                <button
                  type="button"
                  className={hubIdeIconBtn('h-7 w-7')}
                  title="แสดงใน Explorer"
                  onClick={() => requestExplorerReveal(activeTab.rel)}
                >
                  <Codicon name="folder-opened" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                <img
                  src={activeTab.dataUrl}
                  alt={activeTab.name}
                  className="max-h-full max-w-full rounded-sm border border-vscode-border object-contain"
                />
              </div>
            </div>
          ) : activeTab.kind === 'audio' && activeTab.dataUrl ? (
            <div className="flex h-full min-h-0 min-w-0 items-center justify-center bg-vscode-editor p-4">
              <div className="w-full max-w-2xl rounded-sm border border-vscode-border bg-vscode-sidebar p-4">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-vscode-fg-bright">
                  <Codicon name="music" />
                  <span className="min-w-0 truncate" title={activeTab.name}>{activeTab.name}</span>
                </div>
                <audio controls src={activeTab.dataUrl} className="w-full" />
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-vscode-muted">
                  <span className="min-w-0 truncate" title={activeTab.rel}>{activeTab.rel}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-sm border border-vscode-border px-2 py-1 text-vscode-fg-dim hover:bg-vscode-list-hover hover:text-vscode-fg"
                    onClick={() => requestExplorerReveal(activeTab.rel)}
                  >
                    แสดงใน Explorer
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab.kind === 'video' && activeTab.dataUrl ? (
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-vscode-editor">
              <div className="flex items-center justify-between border-b border-vscode-border bg-vscode-sidebar px-3 py-2 text-[12px]">
                <span className="truncate text-vscode-fg-dim" title={activeTab.rel}>{activeTab.rel}</span>
                <button
                  type="button"
                  className={hubIdeIconBtn('h-7 w-7')}
                  title="แสดงใน Explorer"
                  onClick={() => requestExplorerReveal(activeTab.rel)}
                >
                  <Codicon name="folder-opened" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                <video
                  controls
                  src={activeTab.dataUrl}
                  className="max-h-full max-w-full rounded-sm border border-vscode-border bg-black"
                />
              </div>
            </div>
          ) : (
            <HubIdeEditorWatermark
              title="ไม่รองรับการแสดงตัวอย่าง"
              hint="รองรับไฟล์เสียง รูปภาพ และวิดีโอ"
            />
          )}
        </div>
      </section>
    </div>
  )
}
