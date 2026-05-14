/**
 * Cover module entry — forked จาก INKIDEA workspace/cover
 * ใช้ CoverEditor (Fabric.js artboard + zoom/pan + inspector) ของ INKIDEA ตรง ๆ
 * โดย stub workspace concept ผ่าน state/useHubWorkspace shim
 */

import { CoverEditor } from './CoverEditor'

export function CoverModule() {
  return <CoverEditor programActive={true} />
}
