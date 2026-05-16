import { useEffect, useState } from 'react'
import { cn } from '@shared/ui/utils/cn'
import type {
  UpdateAvailableInfo,
  UpdateProgressInfo,
  UpdateDownloadedInfo,
} from '../types/window'

type Phase =
  | { kind: 'idle' }
  | {
      kind: 'available'
      mode: 'auto' | 'portable'
      version: string
      current?: string
      downloadUrl?: string
      releaseUrl?: string
      releaseDate?: string | null
    }
  | { kind: 'downloading'; mode: 'auto' | 'portable'; version: string; percent: number }
  | { kind: 'ready'; mode: 'auto' | 'portable'; version: string }
  | { kind: 'error'; message: string }

function formatThaiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch {
    return iso
  }
}

/**
 * In-app update banner.
 *
 * Listens to the four `app:update*` IPC events emitted by electron/autoUpdate.cjs.
 * Two flows are unified into one UI:
 *   - portable (mac ad-hoc + Win portable + Win NSIS-not-downloaded-yet) —
 *     user clicks "อัพเดตเลย" → download → swap → restart
 *   - auto (Win NSIS post-download) — banner shows "รีสตาร์ทเดี๋ยวนี้"
 *
 * Pattern copied from INKCRAW/.app/shell/src/components/UpdateBanner.tsx,
 * adapted to INKSTUDIO's preload namespace (window.inkstudio.app instead of
 * window.inkcraw.app).
 */
export function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let mounted = true
    const api = window.inkstudio?.app
    if (!api) return

    const showAvailable = (evt: UpdateAvailableInfo) => {
      if (!mounted) return
      setHidden(false)
      setPhase({
        kind: 'available',
        mode: evt.mode,
        version: evt.version,
        current: evt.current,
        downloadUrl: evt.downloadUrl,
        releaseUrl: evt.releaseUrl,
        releaseDate: evt.releaseDate,
      })
    }

    const offAvail = api.onUpdateAvailable(showAvailable)
    const offProgress = api.onUpdateProgress((evt: UpdateProgressInfo) => {
      if (!mounted) return
      setPhase((prev) => {
        if (prev.kind === 'downloading') return { ...prev, percent: evt.percent }
        if (prev.kind === 'available')
          return { kind: 'downloading', mode: prev.mode, version: prev.version, percent: evt.percent }
        return prev
      })
    })
    const offDone = api.onUpdateDownloaded((evt: UpdateDownloadedInfo) => {
      if (!mounted) return
      setPhase({ kind: 'ready', mode: evt.mode, version: evt.version })
    })
    const offError = api.onUpdateError((evt) => {
      if (!mounted) return
      setPhase({ kind: 'error', message: evt.message })
    })

    // Eager manual check so users who open the app right after a release
    // see the banner without waiting for the 30-min periodic tick.
    api.checkUpdate().then((res) => {
      if (!mounted) return
      if (!res?.ok || !res.result?.available) return
      const version = res.result.latest || res.result.version
      if (!version) return
      showAvailable({
        mode: res.result.downloadUrl ? 'portable' : 'auto',
        version,
        current: res.result.current,
        downloadUrl: res.result.downloadUrl,
        releaseUrl: res.result.releaseUrl,
        releaseDate: res.result.releaseDate ?? null,
      })
    })

    return () => {
      mounted = false
      offAvail()
      offProgress()
      offDone()
      offError()
    }
  }, [])

  async function applyPortable() {
    if (phase.kind !== 'available') return
    setPhase({ kind: 'downloading', mode: phase.mode, version: phase.version, percent: 0 })
    const api = window.inkstudio?.app
    if (!api) return
    const res = await api.applyUpdate()
    if (!res.ok) {
      setPhase({ kind: 'error', message: res.error || 'อัพเดตไม่สำเร็จ' })
    }
  }

  if (hidden || phase.kind === 'idle') return null

  const isError = phase.kind === 'error'
  const version = phase.kind !== 'error' ? phase.version : null
  const releaseDate = phase.kind === 'available' ? phase.releaseDate : null
  const releaseUrl = phase.kind === 'available' ? phase.releaseUrl : undefined
  const canApply = phase.kind === 'available' && phase.mode === 'portable'
  const canRestart = phase.kind === 'ready' && phase.mode === 'auto'
  const percent = phase.kind === 'downloading' ? Math.max(2, Math.min(100, phase.percent)) : 0

  const iconClass =
    phase.kind === 'downloading' ? 'codicon-cloud-download codicon-modifier-spin'
    : phase.kind === 'ready' ? 'codicon-pass-filled'
    : isError ? 'codicon-error'
    : 'codicon-arrow-circle-up'

  const headline = (() => {
    switch (phase.kind) {
      case 'available':
        return phase.mode === 'portable' ? 'มีเวอร์ชันใหม่พร้อมติดตั้ง' : 'กำลังเตรียมอัพเดต'
      case 'downloading':
        return 'กำลังดาวน์โหลด'
      case 'ready':
        return phase.mode === 'portable' ? 'ติดตั้งใหม่สำเร็จ — กำลังรีสตาร์ท' : 'อัพเดตพร้อมแล้ว'
      case 'error':
        return 'อัพเดตไม่สำเร็จ'
      default:
        return ''
    }
  })()

  const subline = (() => {
    switch (phase.kind) {
      case 'available':
        if (phase.mode === 'portable') {
          return 'กดอัพเดตเพื่อดาวน์โหลดและสลับเวอร์ชันให้อัตโนมัติ'
        }
        return 'ระบบจะดาวน์โหลดเงียบ ๆ ในพื้นหลัง'
      case 'downloading':
        return `${percent}%`
      case 'ready':
        return phase.mode === 'auto' ? 'รีสตาร์ทเพื่อใช้เวอร์ชันใหม่' : null
      case 'error':
        return phase.message
      default:
        return null
    }
  })()

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative isolate flex items-center gap-3.5 px-4 py-2.5 border-b text-[13px]',
        'transition-colors duration-200',
        isError
          ? 'bg-vscode-error-bg/60 text-vscode-fg-bright border-vscode-error/40'
          : 'bg-gradient-to-r from-vscode-brand/15 via-vscode-brand/10 to-vscode-brand/5 text-vscode-fg-bright border-vscode-brand/25',
      )}
    >
      <span
        className={cn(
          'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
          isError
            ? 'bg-vscode-error/20 ring-vscode-error/40 text-vscode-error'
            : phase.kind === 'ready'
              ? 'bg-vscode-success/15 ring-vscode-success/30 text-vscode-success'
              : 'bg-vscode-brand/25 ring-vscode-brand/40 text-vscode-fg-bright',
        )}
      >
        <i className={cn('codicon text-[14px]', iconClass)} />
      </span>

      <div className="flex flex-1 min-w-0 items-center gap-2.5">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate">{headline}</span>
            {version ? (
              <span className="inline-flex items-center rounded-sm px-1.5 py-px font-mono text-[11px] font-medium bg-vscode-brand/25 text-vscode-fg-bright ring-1 ring-vscode-brand/40 shrink-0">
                v{version}
              </span>
            ) : null}
            {releaseDate ? (
              <span className="text-[11px] text-vscode-fg-dim shrink-0">
                · ออก {formatThaiDate(releaseDate)}
              </span>
            ) : null}
          </div>
          {subline && phase.kind !== 'downloading' ? (
            <span className={cn('text-[11.5px] mt-0.5 truncate', isError ? 'text-vscode-error/90' : 'text-vscode-fg-dim')}>
              {subline}
            </span>
          ) : null}
        </div>

        {phase.kind === 'downloading' ? (
          <div className="flex items-center gap-2 ml-auto min-w-0">
            <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-vscode-border/60 ring-1 ring-vscode-border/40">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-vscode-brand transition-[width] duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-vscode-fg-dim shrink-0 w-10 text-right">
              {percent.toFixed(0)}%
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {releaseUrl ? (
          <button
            type="button"
            onClick={() => window.open(releaseUrl, '_blank', 'noopener,noreferrer')}
            className="inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-[12px] font-medium text-vscode-fg hover:text-vscode-fg-bright hover:bg-vscode-list-hover transition-colors"
          >
            <i className="codicon codicon-link-external text-[12px]" />
            Release
          </button>
        ) : null}
        {canApply ? (
          <button
            type="button"
            onClick={applyPortable}
            className={cn(
              'group inline-flex h-7 items-center gap-1.5 rounded-sm px-3 text-[12px] font-semibold',
              'bg-vscode-brand text-white hover:bg-vscode-brand/90',
              'shadow-sm shadow-vscode-brand/30 transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focus',
            )}
          >
            <i className="codicon codicon-rocket text-[12px] transition-transform group-hover:-translate-y-px" />
            อัพเดตเลย
          </button>
        ) : null}
        {canRestart ? (
          <button
            type="button"
            onClick={() => window.inkstudio?.app.applyUpdate()}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm px-3 text-[12px] font-semibold',
              'bg-vscode-brand text-white hover:bg-vscode-brand/90',
              'shadow-sm shadow-vscode-brand/30 transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focus',
            )}
          >
            <i className="codicon codicon-debug-restart text-[12px]" />
            รีสตาร์ทเดี๋ยวนี้
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setHidden(true)}
          title="ซ่อน"
          aria-label="ซ่อน"
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-vscode-fg-dim hover:text-vscode-fg-bright hover:bg-vscode-list-hover transition-colors"
        >
          <i className="codicon codicon-close text-[13px]" />
        </button>
      </div>
    </div>
  )
}
