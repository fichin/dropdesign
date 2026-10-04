import { describe, expect, it } from 'vitest'
import { ana, makeBoard, marko } from '../test/fixtures'
import { boardReducer, findColumnId, getTeamMembers } from './boardReducer'

const ids = (board: ReturnType<typeof makeBoard>, columnId: string) => board.columns[columnId].taskIds

// moveTask is what drag-and-drop dispatches: for the live preview while dragging, and
// once more (through the sync) when the card is dropped
describe('moveTask (drag and drop)', () => {
  it('reorders within a column', () => {
    const board = boardReducer(makeBoard(), { type: 'moveTask', taskId: 'a', toColumnId: 'todo', toIndex: 2 })
    expect(ids(board, 'todo')).toEqual(['b', 'c', 'a'])
  })

  it('moves a card to another column at the drop position', () => {
    const board = boardReducer(makeBoard(), { type: 'moveTask', taskId: 'b', toColumnId: 'doing', toIndex: 0 })
    expect(ids(board, 'todo')).toEqual(['a', 'c'])
    expect(ids(board, 'doing')).toEqual(['b', 'd'])
    expect(findColumnId(board, 'b')).toBe('doing')
  })

  it('appends when the drop position is past the end, and clamps negative positions', () => {
    let board = boardReducer(makeBoard(), { type: 'moveTask', taskId: 'a', toColumnId: 'doing', toIndex: 99 })
    expect(ids(board, 'doing')).toEqual(['d', 'a'])
    board = boardReducer(board, { type: 'moveTask', taskId: 'c', toColumnId: 'doing', toIndex: -5 })
    expect(ids(board, 'doing')).toEqual(['c', 'd', 'a'])
  })

  it('marks a task done when it lands in Completed', () => {
    const board = boardReducer(makeBoard({ b: { progress: 40 } }), {
      type: 'moveTask',
      taskId: 'b',
      toColumnId: 'done',
      toIndex: 0,
    })
    expect(board.tasks.b.progress).toBe(100)
  })

  it('leaves progress alone when moving between other columns', () => {
    const board = boardReducer(makeBoard({ b: { progress: 40 } }), {
      type: 'moveTask',
      taskId: 'b',
      toColumnId: 'doing',
      toIndex: 0,
    })
    expect(board.tasks.b.progress).toBe(40)
  })

  it('returns the same board when dropped where it started (nothing to save)', () => {
    const before = makeBoard()
    expect(boardReducer(before, { type: 'moveTask', taskId: 'b', toColumnId: 'todo', toIndex: 1 })).toBe(before)
  })

  it('ignores unknown tasks and columns', () => {
    const before = makeBoard()
    expect(boardReducer(before, { type: 'moveTask', taskId: 'zzz', toColumnId: 'doing', toIndex: 0 })).toBe(before)
    expect(boardReducer(before, { type: 'moveTask', taskId: 'a', toColumnId: 'zzz', toIndex: 0 })).toBe(before)
  })

  it('never loses or duplicates a card over a series of moves', () => {
    let board = makeBoard()
    const moves: [string, string, number][] = [
      ['a', 'done', 0],
      ['e', 'todo', 1],
      ['d', 'done', 5],
      ['a', 'doing', 0],
      ['c', 'todo', 0],
    ]
    for (const [taskId, toColumnId, toIndex] of moves) {
      board = boardReducer(board, { type: 'moveTask', taskId, toColumnId, toIndex })
    }
    const all = board.columnOrder.flatMap((columnId) => ids(board, columnId))
    expect(all.toSorted()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('does not mutate the board it was given', () => {
    const before = makeBoard()
    const snapshot = structuredClone(before)
    boardReducer(before, { type: 'moveTask', taskId: 'a', toColumnId: 'done', toIndex: 0 })
    expect(before).toEqual(snapshot)
  })
})

describe('addTask', () => {
  it('adds a trimmed task to the top of the column', () => {
    const board = boardReducer(makeBoard(), { type: 'addTask', taskId: 'new', columnId: 'doing', title: '  Write tests  ' })
    expect(ids(board, 'doing')).toEqual(['new', 'd'])
    expect(board.tasks.new).toMatchObject({ title: 'Write tests', progress: 0, priority: 'ok', dueDate: null })
  })

  it('starts tasks added to Completed at 100%', () => {
    const board = boardReducer(makeBoard(), { type: 'addTask', taskId: 'new', columnId: 'done', title: 'Shipped' })
    expect(board.tasks.new.progress).toBe(100)
  })

  it('ignores blank titles', () => {
    const before = makeBoard()
    expect(boardReducer(before, { type: 'addTask', taskId: 'new', columnId: 'todo', title: '   ' })).toBe(before)
  })
})

describe('updateTask', () => {
  it('applies only the fields given', () => {
    const board = boardReducer(makeBoard(), { type: 'updateTask', taskId: 'a', changes: { priority: 'high-priority' } })
    expect(board.tasks.a).toMatchObject({ priority: 'high-priority', title: 'Task a' })
  })

  it('trims titles and refuses empty ones', () => {
    let board = boardReducer(makeBoard(), { type: 'updateTask', taskId: 'a', changes: { title: '  Renamed ' } })
    expect(board.tasks.a.title).toBe('Renamed')
    board = boardReducer(board, { type: 'updateTask', taskId: 'a', changes: { title: '   ' } })
    expect(board.tasks.a.title).toBe('Renamed')
  })

  it('clears the due date with null', () => {
    const board = boardReducer(makeBoard({ a: { dueDate: '2026-10-01' } }), {
      type: 'updateTask',
      taskId: 'a',
      changes: { dueDate: null },
    })
    expect(board.tasks.a.dueDate).toBeNull()
  })

  it('returns the same board when nothing actually changed', () => {
    const before = makeBoard({ a: { assignees: [ana] } })
    const after = boardReducer(before, {
      type: 'updateTask',
      taskId: 'a',
      changes: { priority: 'ok', title: 'Task a', assignees: [ana] },
    })
    expect(after).toBe(before)
  })
})

describe('deleteTask and adjustCommentCount', () => {
  it('removes the task and its place in the column', () => {
    const board = boardReducer(makeBoard(), { type: 'deleteTask', taskId: 'b' })
    expect(board.tasks.b).toBeUndefined()
    expect(ids(board, 'todo')).toEqual(['a', 'c'])
  })

  it('keeps comment counts from going below zero', () => {
    let board = boardReducer(makeBoard(), { type: 'adjustCommentCount', taskId: 'a', delta: 1 })
    expect(board.tasks.a.commentCount).toBe(1)
    board = boardReducer(board, { type: 'adjustCommentCount', taskId: 'a', delta: -3 })
    expect(board.tasks.a.commentCount).toBe(0)
  })
})

describe('helpers', () => {
  it('findColumnId accepts a task id or a column id', () => {
    const board = makeBoard()
    expect(findColumnId(board, 'd')).toBe('doing')
    expect(findColumnId(board, 'done')).toBe('done')
    expect(findColumnId(board, 'nope')).toBeUndefined()
  })

  it('getTeamMembers lists each assignee once, in board order', () => {
    const board = makeBoard({ c: { assignees: [marko] }, d: { assignees: [ana, marko] } })
    expect(getTeamMembers(board).map((person) => person.id)).toEqual(['u2', 'u1'])
  })
})
