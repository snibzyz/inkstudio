import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cn,
  HubIdeBreadcrumbBar,
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
import type { CoverEditorProps } from './coverEditorTypes'
import { CoverEditorContext } from './CoverEditorContext'
import { useCoverEditor } from './useCoverEditor'
import { CoverCanvas } from './CoverCanvas'
import { CoverInspectorPanel } from './CoverInspectorPanel'
import { CoverExportBar } from './CoverExportBar'
import { CoverCropDialog, type CoverCropKind } from './CoverCropDialog'
import { CoverImagePreviewTab } from './CoverImagePreviewTab'

const COVER_SETTINGS_REL = '.inkidea/pinned/cover-settings'
const COVER_SETTINGS_LABEL = 'ตั้งค่าปก'
const IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/iu

type CoverEditorTab = {
  rel: string
  name: string
  dataUrl: string | null
  loading: boolean
  error: string | null
}

function fileNameFromRel(rel: string): string {
  const parts = rel.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? rel
}

function breadcrumbSegmentsForRel(rel: string) {
  if (rel === COVER_SETTINGS_REL) return [{ label: COVER_SETTINGS_LABEL, title: rel }]
  const parts = rel.split('/').filter(Boolean)
  return parts.map((label, i) => ({ label, title: parts.slice(0, i + 1).join('/') }))
}


export function CoverEditor({ programActive = true }: CoverEditorProps) {
  const ctx = useCoverEditor(programActive)
  const activeProjectId = useHubWorkspace((s) => s.activeProjectId)
  const workspaceOpenFilePath = useHubWorkspace((s) => s.workspaceOpenFilePath)
  const requestWorkspaceFileOpen = useHubWorkspace((s) => s.requestWorkspaceFileOpen)
  const requestExplorerReveal = useHubWorkspace((s) => s.requestExplorerReveal)
  const readWorkspaceFileAsDataUrl = useHubWorkspace((s) => s.readWorkspaceFileAsDataUrl)
  const setEditorTabCloseForMode = useHubWorkspace((s) => s.setEditorTabCloseForMode)
  const setEditorTabCycleForMode = useHubWorkspace((s) => s.setEditorTabCycleForMode)
  const hubWorkspaceActiveMode = useHubWorkspace((s) => s.hubWorkspaceActiveMode)

  const [editorTabs, setEditorTabs] = useState<CoverEditorTab[]>([])
  const [activeRel, setActiveRel] = useState(COVER_SETTINGS_REL)
  const [cropDialogImage, setCropDialogImage] = useState<string | null>(null)
  const [cropDialogKind, setCropDialogKind] = useState<CoverCropKind>('cover')
  const cropConfirmRef = useRef<((dataUrl: string) => Promise<void>) | null>(null)
  const activeRelRef = useRef(activeRel)
  activeRelRef.current = activeRel

  const openCoverCropDialog = useCallback((kind: CoverCropKind, dataUrl: string, onConfirm: (dataUrl: string) => Promise<void>) => {
    cropConfirmRef.current = onConfirm
    setCropDialogKind(kind)
    setCropDialogImage(dataUrl)
  }, [])

  const closeCoverCropDialog = useCallback(() => {
    setCropDialogImage(null)
    cropConfirmRef.current = null
  }, [])

  useEffect(() => {
    setEditorTabs([])
    setActiveRel(COVER_SETTINGS_REL)
  }, [activeProjectId])

  const orderedTabs = useMemo(
    () => [
      {
        rel: COVER_SETTINGS_REL,
        name: COVER_SETTINGS_LABEL,
        dataUrl: null,
        loading: false,
        error: null,
      },
      ...editorTabs,
    ],
    [editorTabs]
  )

  const activeTab = useMemo(
    () => orderedTabs.find((tab) => tab.rel === activeRel) ?? orderedTabs[0],
    [activeRel, orderedTabs]
  )

  const patchTab = useCallback((rel: string, patch: Partial<CoverEditorTab>) => {
    setEditorTabs((prev) => prev.map((tab) => (tab.rel === rel ? { ...tab, ...patch } : tab)))
  }, [])

  const openOrFocusImageTab = useCallback((rel: string) => {
    setEditorTabs((prev) => {
      if (prev.some((tab) => tab.rel === rel)) return prev
      return [
        ...prev,
        {
          rel,
          name: fileNameFromRel(rel),
          dataUrl: null,
          loading: true,
          error: null,
        },
      ]
    })
    setActiveRel(rel)
  }, [])

  const closeTab = useCallback((rel: string) => {
    if (rel === COVER_SETTINGS_REL) return
    setEditorTabs((prev) => {
      const index = prev.findIndex((tab) => tab.rel === rel)
      const next = prev.filter((tab) => tab.rel !== rel)
      setActiveRel((cur) => {
        if (cur !== rel) return cur
        return next[Math.max(0, index - 1)]?.rel ?? COVER_SETTINGS_REL
      })
      return next
    })
  }, [])

  const closeActiveTab = useCallback((): boolean => {
    const rel = activeRelRef.current
    if (rel === COVER_SETTINGS_REL) return false
    closeTab(rel)
    return true
  }, [closeTab])

  useEffect(() => {
    if (!programActive) return
    setEditorTabCloseForMode('cover', closeActiveTab)
    return () => setEditorTabCloseForMode('cover', undefined)
  }, [closeActiveTab, programActive, setEditorTabCloseForMode])

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
    setEditorTabCycleForMode('cover', cycleTab)
    return () => setEditorTabCycleForMode('cover', undefined)
  }, [cycleTab, programActive, setEditorTabCycleForMode])

  useEffect(() => {
    if (!programActive) return
    const rel = workspaceOpenFilePath?.trim()
    if (!rel) return
    if (!IMAGE_EXT_RE.test(rel)) return
    openOrFocusImageTab(rel)
    requestWorkspaceFileOpen(null)
  }, [
    hubWorkspaceActiveMode,
    openOrFocusImageTab,
    programActive,
    requestWorkspaceFileOpen,
    workspaceOpenFilePath,
  ])

  useEffect(() => {
    if (activeTab.rel === COVER_SETTINGS_REL || !activeTab.loading) return
    let cancelled = false
    void readWorkspaceFileAsDataUrl(activeTab.rel)
      .then(({ dataUrl, missing }) => {
        if (cancelled) return
        patchTab(activeTab.rel, {
          dataUrl,
          loading: false,
          error: missing || !dataUrl ? 'ไม่พบไฟล์ภาพใน workspace' : null,
        })
      })
      .catch((e) => {
        if (cancelled) return
        patchTab(activeTab.rel, {
          dataUrl: null,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        })
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, patchTab, readWorkspaceFileAsDataUrl])

  const breadcrumbSegments = useMemo(() => breadcrumbSegmentsForRel(activeTab.rel), [activeTab.rel])

  return (
    <CoverEditorContext.Provider value={{ ...ctx, openCoverCropDialog }}>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-vscode-editor text-vscode-fg">
        <input
          ref={ctx.imagePickerRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          className="hidden"
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-vscode-editor">
          <div className={hubIdeTabsWell} role="tablist" aria-label="แท็บปก">
            {orderedTabs.map((tab) => {
              const isActive = tab.rel === activeTab.rel
              const pinned = tab.rel === COVER_SETTINGS_REL
              return (
                <div
                  key={tab.rel}
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? hubIdeTabActive : hubIdeTabInactive}
                >
                  <button
                    type="button"
                    className={cn(hubIdeTabFileLabel, pinned && 'font-medium')}
                    title={tab.rel}
                    onClick={() => {
                      setActiveRel(tab.rel)
                      if (!pinned) requestExplorerReveal(tab.rel)
                    }}
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
                        closeTab(tab.rel)
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
                'flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden',
                activeTab.rel === COVER_SETTINGS_REL ? '' : 'hidden'
              )}
              aria-hidden={activeTab.rel !== COVER_SETTINGS_REL}
            >
        {ctx.error ? (
          <div
            role="alert"
                  className="flex items-start justify-between gap-3 border-b border-vscode-border bg-vscode-error-bg px-4 py-2.5 text-[12px] text-vscode-error"
          >
            <div className="min-w-0 flex-1">
              <span className="font-semibold">ข้อผิดพลาด: </span>
              <span className="whitespace-pre-wrap break-words">{ctx.error}</span>
            </div>
            <button
              type="button"
              onClick={() => ctx.setError(null)}
              className="shrink-0 rounded-sm border border-vscode-error/30 px-2 py-0.5 text-[11px] text-vscode-error hover:bg-vscode-error/10"
            >
              ปิด
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 divide-x divide-vscode-border xl:flex-row">
          <CoverCanvas />
          <CoverInspectorPanel />
        </div>

        <CoverExportBar />
            </div>

            {activeTab.rel === COVER_SETTINGS_REL ? null : (
              <CoverImagePreviewTab
                tab={activeTab}
                onUseAsCover={(dataUrl) => {
                  ctx.loadTemplateCoverImageFromDataUrl(dataUrl)
                  setActiveRel(COVER_SETTINGS_REL)
                }}
                onUseAsBackground={(dataUrl) => {
                  ctx.loadBackgroundImageFromDataUrl(dataUrl)
                  setActiveRel(COVER_SETTINGS_REL)
                }}
                onAddAsLayer={(dataUrl) => {
                  ctx.addImageLayerFromDataUrl(dataUrl)
                  setActiveRel(COVER_SETTINGS_REL)
                }}
              />
            )}
          </div>
        </section>

        {!programActive ? (
          <div className={cn(hubIdeStatusStrip, 'bg-vscode-sidebar text-vscode-muted')}>
            เครื่องมือปกพักการทำงานไว้จนกว่าแท็บปกจะ active
          </div>
        ) : null}
        <CoverCropDialog
          open={Boolean(cropDialogImage)}
          imageDataUrl={cropDialogImage}
          kind={cropDialogKind}
          onClose={closeCoverCropDialog}
          onConfirm={(dataUrl) => {
            void cropConfirmRef.current?.(dataUrl)
            closeCoverCropDialog()
          }}
        />
      </div>
    </CoverEditorContext.Provider>
  )
}
