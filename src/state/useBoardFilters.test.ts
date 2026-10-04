import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, makeBoard, marko, sara } from '../test/fixtures'
import { useBoardFilters } from './useBoardFilters'

// Fixed "today" so the overdue rule is deterministic
const TODAY = new Date(2026, 9, 4, 12) // 4 Oct 2026, local time

const board = makeBoard({
  a: { title: 'Design landing page', priority: 'high-priority', assignees: [ana], dueDate: '2026-10-01' },
  b: { title: 'Write API docs', description: 'Cover the LANDING endpoints', priority: 'important', assignees: [marko] },
  c: { title: 'Fix login bug', priority: 'ok', assignees: [ana, sara], dueDate: '2026-10-04' },
  d: { title: 'Train the model', priority: 'meh', dueDate: '2026-09-20', progress: 100 },
  e: { title: 'Release notes', priority: 'high-priority', assignees: [sara], dueDate: '2026-09-01', progress: 60 },
})

function setup() {
  const { result } = renderHook(() => useBoardFilters(board))
  const visible = () =>
    Object.values(board.tasks)
      .filter(result.current.matches)
      .map((task) => task.id)
  return { result, visible }
}

describe('useBoardFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })

  it('shows everything with no search or filters', () => {
    const { result, visible } = setup()
    expect(visible()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(result.current.isFiltering).toBe(false)
    expect(result.current.counts).toEqual({ visible: 5, total: 5 })
  })

  it('searches titles and descriptions, ignoring case and surrounding spaces', () => {
    const { result, visible } = setup()
    act(() => result.current.setQuery('  Landing '))
    expect(visible()).toEqual(['a', 'b'])
    expect(result.current.search).toBe('landing')
    expect(result.current.counts).toEqual({ visible: 2, total: 5 })
  })

  it('matches any selected priority (OR within a filter)', () => {
    const { result, visible } = setup()
    act(() => result.current.togglePriority('high-priority'))
    act(() => result.current.togglePriority('meh'))
    expect(visible()).toEqual(['a', 'd', 'e'])
  })

  it('matches tasks with any selected assignee', () => {
    const { result, visible } = setup()
    act(() => result.current.toggleAssignee(sara.id))
    act(() => result.current.toggleAssignee(marko.id))
    expect(visible()).toEqual(['b', 'c', 'e'])
  })

  it('combines search and filters with AND', () => {
    const { result, visible } = setup()
    act(() => result.current.toggleAssignee(ana.id))
    act(() => result.current.togglePriority('high-priority'))
    expect(visible()).toEqual(['a'])
    act(() => result.current.setQuery('bug'))
    expect(visible()).toEqual([])
  })

  it('toggling a filter twice turns it off again', () => {
    const { result, visible } = setup()
    act(() => result.current.togglePriority('ok'))
    act(() => result.current.togglePriority('ok'))
    expect(visible()).toHaveLength(5)
    expect(result.current.activeFilterCount).toBe(0)
  })

  describe('overdue only', () => {
    it('keeps past-due, unfinished tasks', () => {
      const { result, visible } = setup()
      act(() => result.current.setOverdueOnly(true))
      // a: due 1 Oct; e: due 1 Sep at 60%
      expect(visible()).toEqual(['a', 'e'])
    })

    it('never counts a 100% task as overdue', () => {
      const { result, visible } = setup()
      act(() => result.current.setOverdueOnly(true))
      expect(visible()).not.toContain('d')
    })

    it('does not count tasks due today', () => {
      const { result, visible } = setup()
      act(() => result.current.setOverdueOnly(true))
      expect(visible()).not.toContain('c')
    })
  })

  it('counts filter options but not the search text', () => {
    const { result } = setup()
    act(() => result.current.setQuery('docs'))
    expect(result.current.activeFilterCount).toBe(0)
    expect(result.current.isFiltering).toBe(true)

    act(() => result.current.togglePriority('ok'))
    act(() => result.current.toggleAssignee(ana.id))
    act(() => result.current.setOverdueOnly(true))
    expect(result.current.activeFilterCount).toBe(3)
  })

  it('clear() resets search and every filter', () => {
    const { result, visible } = setup()
    act(() => {
      result.current.setQuery('landing')
      result.current.togglePriority('important')
      result.current.toggleAssignee(marko.id)
      result.current.setOverdueOnly(true)
    })
    act(() => result.current.clear())
    expect(result.current.isFiltering).toBe(false)
    expect(result.current.query).toBe('')
    expect(visible()).toHaveLength(5)
  })

  it('reports zero tasks before the board has loaded', () => {
    const { result } = renderHook(() => useBoardFilters(null))
    expect(result.current.counts).toEqual({ visible: 0, total: 0 })
  })
})
