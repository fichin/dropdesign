import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board, Task } from '../../shared/kanban.ts'
import { ana, makeBoard, makeTask, marko } from '../test/fixtures'
import { mockRowHeight, scrollWindowTo } from '../test/layout'
import TaskList, { LIST_VIRTUALIZATION_THRESHOLD } from './TaskList'

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

describe('TaskList with a long list (virtualized)', () => {
  const ROW_HEIGHT = 50

  /** n tasks, "Task 0" to "Task n-1", all in To Do; even ones due before odd ones */
  function longBoard(n: number): Board {
    const tasks = Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`t${i}`, makeTask(`t${i}`, { title: `Task ${i}`, dueDate: i % 2 ? '2026-12-01' : '2026-11-01' })]),
    )
    const board = makeBoard()
    return {
      ...board,
      tasks,
      columns: {
        todo: { ...board.columns.todo, taskIds: Object.keys(tasks) },
        doing: { ...board.columns.doing, taskIds: [] },
        done: { ...board.columns.done, taskIds: [] },
      },
    }
  }

  function setupLong(n: number, isVisible: (task: Task) => boolean = () => true) {
    mockRowHeight(ROW_HEIGHT)
    // The virtualizer nudges the page when a measured row differs from its estimate; jsdom has no scrollTo
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const user = userEvent.setup()
    const onOpenTask = vi.fn()
    render(<TaskList board={longBoard(n)} isVisible={isVisible} search="" onOpenTask={onOpenTask} />)
    const table = screen.getByRole('table')
    const titles = () => within(table).getAllByRole('rowheader').map((cell) => cell.textContent)
    return { user, onOpenTask, table, titles }
  }

  const taskNumber = (title: string | null) => Number(title?.replace('Task ', ''))

  afterEach(() => scrollWindowTo(0))

  // 300 full rows take a few seconds in jsdom, more while the other test files run alongside
  it('keeps rendering every row up to the threshold, exactly as before', { timeout: 20_000 }, () => {
    const { table, titles } = setupLong(LIST_VIRTUALIZATION_THRESHOLD)
    expect(titles()).toHaveLength(LIST_VIRTUALIZATION_THRESHOLD)
    expect(table).not.toHaveAttribute('aria-rowcount')
    expect(table).toHaveClass('task-list', { exact: true })
    expect(table.querySelector('[aria-rowindex], .task-list-spacer')).toBeNull()
  })

  it('renders only the rows near the screen, and tells screen readers the full count', () => {
    const { table, titles } = setupLong(5000)
    // jsdom's window is 768px tall: about 16 rows of 50px, plus 10 extra below
    expect(titles().length).toBeGreaterThan(15)
    expect(titles().length).toBeLessThan(40)
    expect(titles()[0]).toBe('Task 0')
    expect(table).toHaveAttribute('aria-rowcount', '5001')
    expect(screen.getByRole('row', { name: /Task 0/ })).toHaveAttribute('aria-rowindex', '2')
    expect(screen.getByRole('row', { name: /Task 3\b/ })).toHaveAttribute('aria-rowindex', '5')
  })

  it('renders the rows further down as the page scrolls', () => {
    const { titles } = setupLong(5000)
    act(() => scrollWindowTo(2000 * ROW_HEIGHT))
    // Rows not measured yet count at the estimated height, so which row sits at this offset
    // isn't known exactly: it is well down the list, and the top rows are gone
    const first = taskNumber(titles()[0])
    expect(first).toBeGreaterThan(1000)
    expect(titles()).not.toContain('Task 0')
    expect(screen.getByRole('row', { name: new RegExp(`Task ${first}\\b`) })).toHaveAttribute('aria-rowindex', String(first + 2))
  })

  it('sorts and filters every task, not just the rendered ones', async () => {
    const { user, table, titles } = setupLong(5000, (task) => Number(task.id.slice(1)) % 5 !== 0)
    expect(table).toHaveAttribute('aria-rowcount', String(4000 + 1))
    expect(titles().slice(0, 3)).toEqual(['Task 1', 'Task 2', 'Task 3'])
    // Board order, reversed: the last task comes first
    await user.click(within(screen.getByRole('columnheader', { name: /Status/ })).getByRole('button'))
    expect(titles()[0]).toBe('Task 4999')
    // By due date: every task due in November (even numbers) comes before December
    await user.click(within(screen.getByRole('columnheader', { name: /Due date/ })).getByRole('button'))
    expect(titles().slice(0, 3)).toEqual(['Task 2', 'Task 4', 'Task 6'])
  })

  it('keeps the focused row in the page when it scrolls out of view', () => {
    setupLong(5000)
    const title = screen.getByRole('button', { name: 'Task 3' })
    act(() => title.focus())
    act(() => scrollWindowTo(3000 * ROW_HEIGHT))
    expect(title).toBeInTheDocument()
    expect(title).toHaveFocus()
    // ...followed by the rows now on screen, far down the list
    const [focusedRow, nextRow] = screen.getAllByRole('rowheader').map((cell) => taskNumber(cell.textContent))
    expect(focusedRow).toBe(3)
    expect(nextRow).toBeGreaterThan(1000)
  })

  it('opens a task from a rendered row', async () => {
    const { user, onOpenTask } = setupLong(5000)
    await user.click(screen.getByRole('button', { name: 'Task 7' }))
    expect(onOpenTask).toHaveBeenCalledWith('t7')
  })
})
