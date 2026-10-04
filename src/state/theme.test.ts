import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import { changeSystemTheme, mockSystemTheme } from '../test/matchMedia'
import { setTheme, useTheme } from './theme'

// One module instance for the whole file, as in the browser. It keeps no state of its own
// (the theme lives on <html> and in localStorage), so tests don't leak into each other.
const root = document.documentElement

/** The real inline script from index.html, which sets the theme before React mounts */
function runNoFlashScript() {
  const script = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1]
  if (!script) throw new Error('Inline theme script not found in index.html')
  new Function(script)()
}

describe('first paint (inline script in index.html)', () => {
  it('follows a dark system theme when nothing is saved', () => {
    mockSystemTheme(true)
    runNoFlashScript()
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('follows a light system theme when nothing is saved', () => {
    mockSystemTheme(false)
    runNoFlashScript()
    expect(root.dataset.theme).toBe('light')
  })

  it('prefers the saved choice over the system theme', () => {
    mockSystemTheme(true)
    localStorage.setItem('theme', 'light')
    runNoFlashScript()
    expect(root.dataset.theme).toBe('light')
  })

  it('ignores a saved value that is not a theme', () => {
    mockSystemTheme(true)
    localStorage.setItem('theme', 'purple')
    runNoFlashScript()
    expect(root.dataset.theme).toBe('dark')
  })

  it('still picks a theme when storage is blocked', () => {
    mockSystemTheme(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    runNoFlashScript()
    expect(root.dataset.theme).toBe('dark')
  })
})

describe('theme module', () => {
  beforeEach(() => {
    // What the inline script would have done on a light system
    root.dataset.theme = 'light'
  })

  it('setTheme applies the theme and saves it', () => {
    setTheme('dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('useTheme reports the current theme and re-renders on every toggle', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current).toBe('light')

    act(() => setTheme('dark'))
    expect(result.current).toBe('dark')

    act(() => setTheme('light'))
    expect(result.current).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('follows system theme changes while nothing is saved', () => {
    const { result } = renderHook(() => useTheme())

    act(() => changeSystemTheme(true))
    expect(root.dataset.theme).toBe('dark')
    expect(result.current).toBe('dark')

    act(() => changeSystemTheme(false))
    expect(result.current).toBe('light')
  })

  it('ignores system theme changes once the user has chosen', () => {
    setTheme('light')
    changeSystemTheme(true)
    expect(root.dataset.theme).toBe('light')
  })

  it('picks up a choice made in another tab', () => {
    const { result } = renderHook(() => useTheme())

    // The other tab writes storage; this tab only gets the event
    localStorage.setItem('theme', 'dark')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))
    })
    expect(result.current).toBe('dark')
  })

  it('is not affected by other keys changing in another tab', () => {
    localStorage.setItem('theme', 'dark') // saved, but this tab hasn't been told
    window.dispatchEvent(new StorageEvent('storage', { key: 'kanban-board' }))
    expect(root.dataset.theme).toBe('light')
  })

  it('still switches when storage is blocked, it just is not remembered', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError')
    })
    setTheme('dark')
    expect(root.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('turns transitions off only for the instant of the switch', () => {
    const observer = new MutationObserver(() => {})
    observer.observe(root, { attributes: true, attributeFilter: ['class'], attributeOldValue: true })

    setTheme('dark')
    // Each record holds the class list from just before that change
    const classLists = observer.takeRecords().map((record) => record.oldValue ?? '')
    observer.disconnect()

    // It was added (and so present when the theme changed), then removed again
    expect(classLists.some((classes) => classes.includes('theme-switching'))).toBe(true)
    expect(root.classList.contains('theme-switching')).toBe(false)
  })
})
