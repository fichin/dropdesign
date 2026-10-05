import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBoardView } from './boardView'

describe('useBoardView', () => {
  it('starts on Grid', () => {
    const { result } = renderHook(() => useBoardView())
    expect(result.current[0]).toBe('grid')
  })

  it('remembers the chosen view across reloads', () => {
    const first = renderHook(() => useBoardView())
    act(() => first.result.current[1]('row'))
    expect(first.result.current[0]).toBe('row')
    first.unmount()

    // A fresh mount reads it back, as after a page reload
    const second = renderHook(() => useBoardView())
    expect(second.result.current[0]).toBe('row')
  })

  it('ignores a saved value that is not a view', () => {
    localStorage.setItem('board-view', 'kanban-3d')
    const { result } = renderHook(() => useBoardView())
    expect(result.current[0]).toBe('grid')
  })

  it('still switches when storage is blocked, it just is not remembered', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const { result } = renderHook(() => useBoardView())
    expect(result.current[0]).toBe('grid')
    act(() => result.current[1]('list'))
    expect(result.current[0]).toBe('list')
  })
})
