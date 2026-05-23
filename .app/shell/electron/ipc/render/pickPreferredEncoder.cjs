'use strict'
/**
 * pickPreferredEncoder — pure picker, no node deps.
 *
 * Lives in its own .cjs file (away from `renderHelpers.cjs` which pulls in
 * ffmpeg-static + spawn) so vitest can require it directly from a unit test.
 *
 * Strategy = **compatibility-first H.264 hardware**:
 *   1. H.264 NVENC (Windows/Linux) — fastest + universal H.264 playback
 *   2. H.264 VideoToolbox (macOS)
 *   3. Software H.264 (CPU, always works)
 *
 * H.265 variants are exposed in the UI when they probe OK but are never
 * picked as the default — the user must opt in manually if they want the
 * ~40% smaller file (HEVC playback support is not universal).
 *
 * `encoders` is the probe map produced by `diagnoseEncoder`:
 *   { nvencH264, nvencHevc, vtH264, vtHevc, software }
 * where each entry is `{ ok: boolean, error: string }`.
 */
function pickPreferredEncoder({ platform, encoders }) {
  if (!encoders || typeof encoders !== 'object') return 'Software (H.264)'
  if (platform === 'darwin') {
    if (encoders.vtH264 && encoders.vtH264.ok) return 'VideoToolbox (H.264)'
    return 'Software (H.264)'
  }
  if (encoders.nvencH264 && encoders.nvencH264.ok) return 'NVENC (H.264)'
  return 'Software (H.264)'
}

module.exports = { pickPreferredEncoder }
