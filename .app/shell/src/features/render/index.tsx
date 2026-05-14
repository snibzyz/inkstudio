/**
 * Render module entry — forked จาก INKIDEA workspace/render
 * ใช้ RenderTab (sections-driven settings + job orchestration) ของ INKIDEA ตรง ๆ
 */

import { RenderTab } from './RenderTab'

export function RenderModule() {
  return <RenderTab programActive={true} />
}
