import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board as BoardType } from '../../shared/kanban.ts'
import { boardReducer } from '../state/boardReducer'
import { makeBoard, makeTask } from '../test/fixtures'
import { mockCardHeight } from '../test/layout'
import Board from './Board'

// The real card, plus a count of how often each one is rendered
const renders = vi.hoisted(() => new Map<string, number>())
vi.mock('./Card', async (importOriginal) => {
  const { default: RealCard } = await importOriginal<typeof import('./Card')>()
  return {
    default: function CountedCard(props: ComponentProps<typeof RealCard>) {
      renders.set(props.task.id, (renders.get(props.task.id) ?? 0) + 1)
      return <RealCard {...props} />
    },
  }
})

const noop = () => {}

/** Board with its own state, the way BoardScreen holds it: the board, and which task is open */
function BoardHarness() {
  const [board, setBoard] = useState(() =>
    makeBoard({ a: { title: 'Alpha' }, b: { title: 'Bravo' }, c: { title: 'Charlie' }, d: { title: 'Delta' } }),
  )
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setBoard((current) => boardReducer(current, { type: 'updateTask', taskId: 'a', changes: { title: 'Alpha, renamed' } }))
        }
      >
        Rename Alpha
      </button>
      <p>Open: {openTaskId ?? 'none'}</p>
      <Board board={board} readOnly={false} onAddTask={noop} onMoveTask={noop} onOpenTask={setOpenTaskId} />
    </>
  )
}

/** The same, in the Column view, with 150 tasks in To Do: a virtualized column */
function LongColumnHarness() {
  const [board, setBoard] = useState<BoardType>(() => {
    const board = makeBoard()
    const tasks = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`t${i}`, makeTask(`t${i}`, { title: `Task ${i}` })]))
    return { ...board, tasks: { ...board.tasks, ...tasks }, columns: { ...board.columns, todo: { ...board.columns.todo, taskIds: Object.keys(tasks) } } }
  })
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setBoard((current) => boardReducer(current, { type: 'updateTask', taskId: 't1', changes: { title: 'Task 1, renamed' } }))
        }
      >
        Rename Task 1
      </button>
      <Board board={board} layout="column" readOnly={false} onAddTask={noop} onMoveTask={noop} onOpenTask={noop} />
    </>
  )
}

/** Renders per card since the last call */
function takeRenders() {
  const counts = Object.fromEntries(renders)
  renders.clear()
  return counts
}

describe('Board rendering', () => {
  beforeEach(() => renders.clear())

  it('re-renders only the card that changed', async () => {
    const user = userEvent.setup()
    render(<BoardHarness />)
    expect(takeRenders()).toEqual({ a: 1, b: 1, c: 1, d: 1, e: 1 })

    await user.click(screen.getByRole('button', { name: 'Rename Alpha' }))

    expect(screen.getByRole('heading', { name: 'Alpha, renamed' })).toBeInTheDocument()
    // b and c share Alpha's column, d and e are in other columns: none of them render again
    expect(takeRenders()).toEqual({ a: 1 })
  })

  it('re-renders only the card that changed in a virtualized column', async () => {
    mockCardHeight(180)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<LongColumnHarness />)
    const rendered = Object.keys(takeRenders())
    // Only a window of the 150 cards is in the page
    expect(rendered.length).toBeLessThan(30)
    expect(rendered).toContain('t1')

    await user.click(screen.getByRole('button', { name: 'Rename Task 1' }))

    expect(screen.getByRole('heading', { name: 'Task 1, renamed' })).toBeInTheDocument()
    expect(takeRenders()).toEqual({ t1: 1 })
  })

  it('renders no cards when only state outside the board changes', async () => {
    const user = userEvent.setup()
    render(<BoardHarness />)
    takeRenders()

    await user.click(screen.getByRole('heading', { name: 'Bravo' }))

    expect(screen.getByText('Open: b')).toBeInTheDocument()
    expect(takeRenders()).toEqual({})
  })
})
