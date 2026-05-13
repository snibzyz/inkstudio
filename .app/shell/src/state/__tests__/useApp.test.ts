import { beforeEach, describe, expect, it } from 'vitest'

beforeEach(async () => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  const { useApp } = await import('../useApp')
  useApp.setState({ activeModule: 'cover' })
})

describe('useApp — module switching', () => {
  it('default active module = cover', async () => {
    const { useApp } = await import('../useApp')
    expect(useApp.getState().activeModule).toBe('cover')
  })

  it('setActiveModule สลับไป render', async () => {
    const { useApp } = await import('../useApp')
    useApp.getState().setActiveModule('render')
    expect(useApp.getState().activeModule).toBe('render')
  })

  it('setActiveModule persist ลง localStorage', async () => {
    const { useApp } = await import('../useApp')
    useApp.getState().setActiveModule('render')
    const raw = localStorage.getItem('inkstudio:app:v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.activeModule).toBe('render')
  })

  it('สลับไป-มาได้', async () => {
    const { useApp } = await import('../useApp')
    const sm = useApp.getState().setActiveModule
    sm('render')
    sm('cover')
    sm('render')
    expect(useApp.getState().activeModule).toBe('render')
  })
})
