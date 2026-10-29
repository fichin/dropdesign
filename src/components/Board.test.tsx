import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { boardReducer } from '../state/boardReducer'
import { makeBoard } from '../test/fixtures'
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

  it('renders no cards when only state outside the board changes', async () => {
    const user = userEvent.setup()
    render(<BoardHarness />)
    takeRenders()

    await user.click(screen.getByRole('heading', { name: 'Bravo' }))

    expect(screen.getByText('Open: b')).toBeInTheDocument()
    expect(takeRenders()).toEqual({})
  })
})
