import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../../shared/kanban.ts'
import { ana, makeBoard, marko } from '../test/fixtures'
import TaskList from './TaskList'

// todo [a, b, c], doing [d], done [e]; "today" is fixed for the overdue styling
const board = makeBoard({
  a: { title: 'Alpha', dueDate: '2026-10-20', priority: 'high-priority', assignees: [ana, marko] },
  b: { title: 'Bravo', dueDate: null },
  c: { title: 'Charlie', dueDate: '2026-10-01' },
  d: { title: 'Delta', dueDate: '2026-10-10' },
  e: { title: 'Echo', dueDate: '2026-09-01', progress: 100 },
})

function setup(isVisible: (task: Task) => boolean = () => true, search = '') {
  const user = userEvent.setup()
  const onOpenTask = vi.fn()
  render(<TaskList board={board} isVisible={isVisible} search={search} onOpenTask={onOpenTask} />)
  const titles = () =>
    within(screen.getByRole('table'))
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
  return { user, onOpenTask, titles }
}

describe('TaskList (List view)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 12))
  })

  it('lists every task in board order with its status, priority, due date and assignees', () => {
    const { titles } = setup()
    expect(titles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
    const alpha = screen.getByRole('row', { name: /Alpha/ })
    expect(within(alpha).getByText('To Do')).toBeInTheDocument()
    expect(within(alpha).getByText('High Priority')).toBeInTheDocument()
    expect(within(alpha).getByRole('list', { name: 'Ana Petrova, Marko Ilievski' })).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Bravo/ })).getByText('No due date')).toBeInTheDocument()
  })

  it('marks overdue dates, but never for finished tasks', () => {
    setup()
    const due = (title: string) => within(screen.getByRole('row', { name: new RegExp(title) })).getByText(/Oct|Sep/).closest('.card-due')
    expect(due('Charlie')).toHaveClass('card-due-overdue') // 1 Oct, not done
    expect(due('Alpha')).not.toHaveClass('card-due-overdue') // future
    expect(due('Echo')).not.toHaveClass('card-due-overdue') // past, but 100%
  })

  it('sorts by status (board order), flipping on a second click', async () => {
    const { user, titles } = setup()
    const header = screen.getByRole('columnheader', { name: /Status/ })
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    await user.click(within(header).getByRole('button'))
    expect(header).toHaveAttribute('aria-sort', 'descending')
    expect(titles()).toEqual(['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha'])
  })

  it('sorts by due date, with undated tasks last in both directions', async () => {
    const { user, titles } = setup()
    const header = screen.getByRole('columnheader', { name: /Due date/ })
    await user.click(within(header).getByRole('button'))
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: /Status/ })).toHaveAttribute('aria-sort', 'none')
    expect(titles()).toEqual(['Echo', 'Charlie', 'Delta', 'Alpha', 'Bravo'])
    await user.click(within(header).getByRole('button'))
    expect(titles()).toEqual(['Alpha', 'Delta', 'Charlie', 'Echo', 'Bravo'])
  })

  it('applies the search and filters', () => {
    const { titles } = setup((task) => task.title.includes('a') && task.title !== 'Bravo', 'a')
    expect(titles()).toEqual(['Alpha', 'Charlie', 'Delta'])
  })

  it('says so when nothing matches', () => {
    setup(() => false)
    expect(screen.getByText('No matching tasks')).toBeInTheDocument()
  })

  it('opens a task from its title button (keyboard) or a click on the row', async () => {
    const { user, onOpenTask } = setup()
    const title = screen.getByRole('button', { name: 'Delta' })
    expect(title).toHaveAttribute('aria-haspopup', 'dialog')
    title.focus()
    await user.keyboard('{Enter}')
    expect(onOpenTask).toHaveBeenLastCalledWith('d')
    await user.click(within(screen.getByRole('row', { name: /Echo/ })).getByText('Completed'))
    expect(onOpenTask).toHaveBeenLastCalledWith('e')
    expect(onOpenTask).toHaveBeenCalledTimes(2)
  })
})
