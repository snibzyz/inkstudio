import { cn } from '@shared/ui'
import {
  Circle as CircleIcon,
  Eye, EyeOff,
  Image as ImageIcon,
  Layers,
  Palette,
  Square,
  Trash2, Type,
} from 'lucide-react'
import type * as fabric from 'fabric'
import type { InkLayerKind } from '../coverEditorTypes'
import { useCoverEditorCtx } from '../CoverEditorContext'
import { IconBtnSm, InspectorSection } from './InspectorSection'

const KIND_LABEL: Record<InkLayerKind, string> = {
  text: 'ข้อความ',
  image: 'ภาพ',
  shape: 'รูปทรง',
  background: 'พื้นหลัง',
}

function LayerKindIcon({ kind }: { kind: InkLayerKind }) {
  if (kind === 'text') return <Type className="h-[13px] w-[13px] shrink-0 text-vscode-info" />
  if (kind === 'image') return <ImageIcon className="h-[13px] w-[13px] shrink-0 text-vscode-folder" />
  if (kind === 'shape') return <Square className="h-[13px] w-[13px] shrink-0 text-vscode-syntax-keyword" />
  return <Palette className="h-[13px] w-[13px] shrink-0 text-vscode-muted" />
}

export function LayersSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const {
    busy,
    fabricRef,
    layers,
    selectedLayerId,
    setSelectedLayerId,
    addTextLayer,
    addRectangleLayer,
    addCircleLayer,
    chooseAddImageLayer,
    syncLayers,
    syncSelectionFromCanvas,
  } = useCoverEditorCtx()

  return (
    <InspectorSection
      id="sect-layers"
      title="เลเยอร์"
      icon={<Layers className="h-3 w-3" aria-hidden />}
      open={open}
      onToggle={onToggle}
      actions={
        <>
          <IconBtnSm title="เพิ่มข้อความ" disabled={busy} onClick={addTextLayer}>
            <Type className="h-3.5 w-3.5" />
          </IconBtnSm>
          <IconBtnSm title="เพิ่มรูปภาพ" disabled={busy} onClick={chooseAddImageLayer}>
            <ImageIcon className="h-3.5 w-3.5" />
          </IconBtnSm>
          <IconBtnSm title="เพิ่มสี่เหลี่ยม" disabled={busy} onClick={addRectangleLayer}>
            <Square className="h-3.5 w-3.5" />
          </IconBtnSm>
          <IconBtnSm title="เพิ่มวงกลม" disabled={busy} onClick={addCircleLayer}>
            <CircleIcon className="h-3.5 w-3.5" />
          </IconBtnSm>
        </>
      }
    >
      {(() => {
        // The "พื้นหลัง" rect is a system fill backing (color/gradient/transparent),
        // not a user layer — managed via the "พื้นหลัง" inspector section. Hide it here
        // so the layer list only shows things the user actually placed or can edit/delete.
        const userLayers = layers.filter((l) => !(l.kind === 'background' && l.label === 'พื้นหลัง'))
        if (userLayers.length === 0) {
          return (
            <div className="-mx-3 -my-3 px-3 py-4 text-[12px] text-vscode-muted">ยังไม่มีเลเยอร์</div>
          )
        }
        return (
      <div className="-mx-3 -my-3 max-h-72 overflow-y-auto overflow-x-hidden">
        {userLayers.slice().reverse().map((l) => {
          const isActive = l.id === selectedLayerId
          const isBg = false // user-deletable now

          return (
            <div
              key={l.id}
              className={cn(
                'group/layer flex items-center gap-2 border-b border-vscode-border/30 border-l-[2px] px-2 py-[7px] select-none',
                isActive
                  ? 'border-l-vscode-focus bg-vscode-list-active'
                  : 'border-l-transparent hover:bg-vscode-list-hover'
              )}
            >
              <LayerKindIcon kind={l.kind} />

              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                title={`เลือกเลเยอร์: ${l.label}`}
                onClick={() => {
                  const c = fabricRef.current
                  if (!c) return
                  const obj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === l.id)
                  if (!obj || obj.selectable === false) return
                  c.setActiveObject(obj)
                  c.requestRenderAll()
                  syncSelectionFromCanvas()
                }}
              >
                <div className={cn('truncate text-[12px] font-medium leading-tight', isActive ? 'text-vscode-fg' : 'text-vscode-fg-dim')}>
                  {l.label}
                </div>
                <div className="truncate text-[10px] leading-tight text-vscode-muted">
                  {KIND_LABEL[l.kind]}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  title={l.visible ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์'}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-vscode-muted transition-colors hover:bg-vscode-list-hover hover:text-vscode-fg"
                  onClick={() => {
                    const c = fabricRef.current
                    if (!c) return
                    const obj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === l.id)
                    if (!obj) return
                    obj.set({ visible: !obj.visible })
                    c.requestRenderAll()
                    syncLayers()
                  }}
                >
                  {l.visible
                    ? <Eye className="h-3.5 w-3.5" aria-hidden />
                    : <EyeOff className="h-3.5 w-3.5 opacity-50" aria-hidden />}
                  <span className="sr-only">{l.visible ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์'}</span>
                </button>

                {!isBg ? (
                  <button
                    type="button"
                    title="ลบเลเยอร์"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-vscode-muted transition-colors hover:bg-vscode-error/15 hover:text-vscode-error"
                    onClick={() => {
                      const c = fabricRef.current
                      if (!c) return
                      const obj = c.getObjects().find((o) => (o as fabric.Object & { inkideaLayerId?: string }).inkideaLayerId === l.id)
                      if (!obj) return
                      c.remove(obj)
                      c.discardActiveObject()
                      c.requestRenderAll()
                      setSelectedLayerId(null)
                      syncLayers()
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">ลบเลเยอร์</span>
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
        )
      })()}
    </InspectorSection>
  )
}
