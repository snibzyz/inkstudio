/**
 * Section "การเข้ารหัสวิดีโอ" — codec / CRF slider / resolution
 *   - Codec: dropdown (NVENC H.264/H.265 / Software H.264)
 *   - CRF: slider + ตัวเลข — auto-clear machine preset selection ถ้าค่าไม่ตรง
 *   - Resolution: ToggleGroup 3 ปุ่ม
 */

import { useEffect, useState } from 'react'
import {
  Codicon,
  HubSettingsAlert,
  HubSettingsField,
  HubSettingsInput,
  HubSettingsToggleGroup,
  hubSettingsInputClass,
} from '@shared/ui'
import { useRender } from '../useRender'

type ProbeResult = { ok: boolean; error: string }
type EncoderDiag = {
  preferred?: string
  platform?: string
  gpu: { name: string; driver: string } | null
  nvenc: ProbeResult
  encoders?: {
    nvencH264: ProbeResult
    nvencHevc: ProbeResult
    vtH264: ProbeResult
    vtHevc: ProbeResult
    software: ProbeResult
  }
}

/** map encoder value → probe-result key in the diag payload */
const PROBE_KEY_BY_VALUE: Record<string, keyof NonNullable<EncoderDiag['encoders']>> = {
  'NVENC (H.264)': 'nvencH264',
  'NVENC (H.265)': 'nvencHevc',
  'VideoToolbox (H.264)': 'vtH264',
  'VideoToolbox (H.265)': 'vtHevc',
  'Software (H.264)': 'software',
}
import {
  CRF_MAX,
  CRF_MIN,
  ENCODE_OPTIONS,
  FIXED_AUDIO_INFO,
  RESOLUTION_OPTIONS,
} from '../renderConstants'
import type { ResolutionValue } from '../renderTypes'

const RESOLUTION_TOGGLE_OPTIONS = RESOLUTION_OPTIONS.map((r) => ({
  value: r.value as ResolutionValue,
  label: r.label,
  hint: r.hint,
}))

export function RenderEncodingSection() {
  const encodeOption = useRender((s) => s.encodeOption)
  const encoderUserSet = useRender((s) => s.encoderUserSet)
  const setEncodeOption = useRender((s) => s.setEncodeOption)
  const crfValue = useRender((s) => s.crfValue)
  const setCrfValue = useRender((s) => s.setCrfValue)
  const resolution = useRender((s) => s.resolution)
  const setResolution = useRender((s) => s.setResolution)
  const busy = useRender((s) => s.busy)

  /** วินิจฉัย encoder จริง (probe ทุก codec) — แสดงเหตุผลถ้า GPU มีแต่ใช้ไม่ได้ */
  const [encoderDiag, setEncoderDiag] = useState<EncoderDiag | null>(null)
  useEffect(() => {
    const ipc = typeof window !== 'undefined' ? window.electron?.ipc : undefined
    if (!ipc?.diagnoseEncoder) return
    let cancelled = false
    void ipc.diagnoseEncoder()
      .then((d) => {
        if (cancelled) return
        setEncoderDiag(d)
        // Auto-switch to the system-picked encoder ONLY when the user has not
        // chosen one explicitly. If a persisted option fails to probe (driver
        // missing, ย้ายเครื่อง, etc.), this is what guarantees the next render
        // doesn't crash on a non-existent codec.
        if (!encoderUserSet && d?.preferred && d.preferred !== encodeOption) {
          setEncodeOption(d.preferred, { auto: true })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /** มี GPU NVIDIA ในเครื่องแต่ probe NVENC ไม่ผ่าน — ต้องเตือนผู้ใช้พร้อมเหตุผล */
  const gpuUnavailable = Boolean(encoderDiag?.gpu && !encoderDiag.nvenc.ok)

  /**
   * Filter encoder options to ONLY those that probed OK on this machine.
   * Until probe results arrive, fall back to the OS-aware filter so we
   * never render an empty dropdown — the probe-aware filter takes over on
   * the next render. This guarantees a user can never pick an encoder
   * the system has determined will fail at render time.
   */
  const platform = typeof window !== 'undefined' ? window.electron?.platform : undefined
  const probes = encoderDiag?.encoders
  const visibleEncodeOptions = ENCODE_OPTIONS.filter((o) => {
    if (probes) {
      const key = PROBE_KEY_BY_VALUE[o.value]
      return key ? probes[key]?.ok === true : false
    }
    // pre-probe fallback (older diag payload, or probe still in flight)
    if (o.value.startsWith('NVENC')) return platform !== 'darwin'
    if (o.value.startsWith('VideoToolbox')) return platform === 'darwin'
    return true
  })
  /** ค่าที่ persist ไว้อาจไม่ตรง OS ปัจจุบัน (ย้ายเครื่อง) — เพิ่ม option ชั่วคราวให้ select แสดงถูก */
  const encoderInList = visibleEncodeOptions.some((o) => o.value === encodeOption)

  /** badge แสดงสถานะ: ระบบตรวจ vs user เลือกเอง */
  const usingHardware = encodeOption !== 'Software (H.264)'
  const encoderBadge = !encoderUserSet
    ? {
        text: usingHardware ? 'ตรวจพบฮาร์ดแวร์เรนเดอร์ในเครื่อง' : 'ไม่พบฮาร์ดแวร์เรนเดอร์ — ใช้ CPU',
        tone: usingHardware ? 'success' : 'neutral' as const,
      }
    : null

  return (
    <div className="space-y-3">
      {gpuUnavailable ? (
        <HubSettingsAlert tone="warning" icon={<Codicon name="warning" />}>
          <div className="text-vscode-fg">
            พบการ์ดจอ {encoderDiag?.gpu?.name ?? 'NVIDIA'} แต่ยังเรนเดอร์ด้วย GPU ไม่ได้
            {encoderDiag?.gpu?.driver ? ` (ไดรเวอร์ ${encoderDiag.gpu.driver})` : ''}
          </div>
          <div className="mt-0.5 text-vscode-fg-dim">{encoderDiag?.nvenc.error}</div>
        </HubSettingsAlert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <HubSettingsField
          label="ความเร็วในการทำคลิป"
          hint="เลือกตามความสามารถของเครื่อง — มีการ์ดจอ NVIDIA จะเร็วกว่า CPU มาก"
        >
          <div className="space-y-1.5">
            <select
              value={encodeOption}
              onChange={(e) => setEncodeOption(e.target.value)}
              disabled={busy}
              className={hubSettingsInputClass}
            >
              {visibleEncodeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {/** ค่าปัจจุบันไม่อยู่ในรายการของ OS นี้ (preset เก่า/ย้ายเครื่อง) — แสดงไว้ไม่ให้ select เพี้ยน */}
              {!encoderInList ? (
                <option value={encodeOption}>{encodeOption}</option>
              ) : null}
            </select>
            {encoderBadge ? (
              <div
                className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10.5px] ${
                  encoderBadge.tone === 'success'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-vscode-border bg-vscode-input/30 text-vscode-fg-dim'
                }`}
                title="ระบบเลือกให้อัตโนมัติ — เปลี่ยนเองได้ทุกเมื่อ"
              >
                <Codicon name={encoderBadge.tone === 'success' ? 'zap' : 'info'} size={10} />
                {encoderBadge.text}
              </div>
            ) : null}
          </div>
        </HubSettingsField>

        <HubSettingsField
          label={`คุณภาพภาพ (CRF ${crfValue})`}
          hint="เลขน้อย = ภาพคมชัด ไฟล์ใหญ่ · เลขมาก = ภาพหยาบ ไฟล์เล็ก"
        >
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={CRF_MIN}
              max={CRF_MAX}
              step={1}
              value={crfValue}
              onChange={(e) => setCrfValue(Number(e.target.value))}
              disabled={busy}
              className="h-1.5 flex-1 cursor-pointer accent-vscode-focus disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="คุณภาพภาพ"
            />
            <div className="w-16 shrink-0">
              <HubSettingsInput
                type="number"
                min={CRF_MIN}
                max={CRF_MAX}
                step={1}
                value={crfValue}
                onChange={(e) => setCrfValue(Number(e.target.value))}
                disabled={busy}
                className="text-center"
              />
            </div>
          </div>
        </HubSettingsField>
      </div>

      <HubSettingsField
        label="ขนาดวิดีโอ"
        hint="นิยายเสียง (ภาพไม่ขยับ) ใช้ 240p ก็พอ — เลือกสูงขึ้นได้ถ้าต้องการ"
      >
        <HubSettingsToggleGroup
          ariaLabel="ขนาดวิดีโอ"
          value={resolution as ResolutionValue}
          options={RESOLUTION_TOGGLE_OPTIONS}
          onChange={(v) => setResolution(v)}
        />
      </HubSettingsField>

      <HubSettingsAlert tone="neutral" icon={<Codicon name="info" />}>
        <span className="text-vscode-fg-dim">ตั้งตายตัวให้แล้ว: </span>
        <span className="text-vscode-fg">{FIXED_AUDIO_INFO}</span>
      </HubSettingsAlert>
    </div>
  )
}
