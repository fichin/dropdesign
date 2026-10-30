import { describe, expect, it } from 'vitest'
import { loadCachedBoard, saveCachedBoard } from '../state/storage'
import { isCapped } from './demoSizes'
import { DEMO_ID_PREFIX, generateDemoBoard } from './generateDemoBoard'

const today = new Date(2026, 9, 30)

describe('generateDemoBoard', () => {
  it('makes exactly the number of tasks asked for, each in exactly one column', () => {
    for (const count of [0, 1, 1000, 10_000]) {
      const board = generateDemoBoard(count, { today })
      const placed = board.columnOrder.flatMap((id) => board.columns[id].taskIds)
      expect(Object.keys(board.tasks)).toHaveLength(count)
      expect(placed).toHaveLength(count)
      expect(new Set(placed).size).toBe(count)
      expect(placed.every((id) => id in board.tasks)).toBe(true)
    }
  })

  it("passes the app's own checks for a board (the ones the offline copy must pass)", () => {
    saveCachedBoard(generateDemoBoard(1000, { today }))
    expect(loadCachedBoard()).not.toBeNull()
  })

  it('spreads the tasks across To Do, In Progress and Completed, like a real board', () => {
    const board = generateDemoBoard(1000, { today })
    expect(board.columnOrder.map((id) => board.columns[id].status)).toEqual(['todo', 'in-progress', 'completed'])
    for (const id of board.columnOrder) expect(board.columns[id].taskIds.length).toBeGreaterThan(150)
    // Completed means done, as the board's own rule for that column says
    const completed = board.columns[board.columnOrder[2]].taskIds.map((id) => board.tasks[id])
    expect(completed.every((task) => task.progress === 100)).toBe(true)
    expect(new Set(Object.values(board.tasks).map((task) => task.title)).size).toBe(1000)
  })

  it('gives the same board for the same seed, and a different one for another seed', () => {
    expect(generateDemoBoard(500, { today })).toEqual(generateDemoBoard(500, { today }))
    expect(generateDemoBoard(500, { seed: 2, today })).not.toEqual(generateDemoBoard(500, { today }))
  })

  it('uses only demo ids and no outside URLs (thousands of avatars must not mean thousands of requests)', () => {
    const board = generateDemoBoard(1000, { today })
    const ids = [board.id, ...Object.keys(board.tasks), ...board.columnOrder, ...board.people.map((p) => p.id)]
    expect(ids.every((id) => id.startsWith(DEMO_ID_PREFIX))).toBe(true)
    expect(JSON.stringify(board)).not.toMatch(/https?:/)
    expect(board.people.every((person) => person.avatarUrl.startsWith('data:image/svg+xml,'))).toBe(true)
  })
})

describe('demo view limits', () => {
  it('shows the Grid and Row views with up to 1,000 tasks, and the Column and List views with any number', () => {
    expect(isCapped('grid', 1000)).toBe(false)
    expect(isCapped('grid', 1001)).toBe(true)
    expect(isCapped('row', 5000)).toBe(true)
    expect(isCapped('column', 10_000)).toBe(false)
    expect(isCapped('list', 10_000)).toBe(false)
  })
})
