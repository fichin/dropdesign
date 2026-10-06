import { DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../../shared/kanban.ts'
import { makeBoard } from '../test/fixtures'
import Column from './Column'

/** The board's drag-and-drop context, with its click-friendly sensor (a few pixels before a drag starts) */
function BoardDnd({ children }: { children: ReactNode }) {
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }))
  return <DndContext sensors={sensors}>{children}</DndContext>
}

const board = makeBoard({ a: { title: 'Alpha' }, b: { title: 'Bravo' }, c: { title: 'Charlie' } })
const todo = board.columns.todo
const allTodo = todo.taskIds.map((id) => board.tasks[id])

function setup({ tasks = allTodo, filtering = false, readOnly = false, column = todo }: { tasks?: Task[]; filtering?: boolean; readOnly?: boolean; column?: typeof todo } = {}) {
  const user = userEvent.setup()
  const onAddTask = vi.fn()
  const onOpenTask = vi.fn()
  // Columns live inside the board's drag-and-drop context
  render(
    <BoardDnd>
      <Column
        column={column}
        tasks={tasks}
        filtering={filtering}
        search=""
        isDropTarget={false}
        readOnly={readOnly}
        onAddTask={onAddTask}
        onOpenTask={onOpenTask}
      />
    </BoardDnd>,
  )
  return { user, onAddTask, onOpenTask }
}

describe('Column', () => {
  it('is a labelled region with its title, task count and cards', () => {
    setup()
    const region = screen.getByRole('region', { name: 'To Do (3)' })
    expect(region).toHaveAttribute('data-status', 'todo') // drives the colour dot
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('shows "N of M" while filtering', () => {
    setup({ tasks: [board.tasks.b], filtering: true })
    expect(screen.getByRole('region', { name: 'To Do (1 of 3)' })).toBeInTheDocument()
  })

  it('says when a column has no tasks', () => {
    setup({ tasks: [], column: { ...todo, taskIds: [] } })
    expect(screen.getByRole('region', { name: 'To Do (0)' })).toBeInTheDocument()
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })

  it('says "No matching tasks" when filtering hides every card', () => {
    setup({ tasks: [], filtering: true })
    expect(screen.getByText('No matching tasks')).toBeInTheDocument()
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument()
  })

  it('adds a task from the header button', async () => {
    const { user, onAddTask } = setup()
    const add = screen.getByRole('button', { name: 'Add task to To Do' })
    expect(add).toHaveAttribute('aria-expanded', 'false')
    await user.click(add)
    expect(add).toHaveAttribute('aria-expanded', 'true')

    const title = screen.getByRole('textbox', { name: 'Task title' })
    expect(title).toHaveFocus()
    await user.type(title, 'Write the launch email{Enter}')
    expect(onAddTask).toHaveBeenCalledWith('todo', 'Write the launch email')
    expect(screen.queryByRole('textbox', { name: 'Task title' })).not.toBeInTheDocument()
  })

  it('hides the empty message while the add form is open', async () => {
    const { user } = setup({ tasks: [], column: { ...todo, taskIds: [] } })
    await user.click(screen.getByRole('button', { name: 'Add task to To Do' }))
    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument()
  })

  it("can't add tasks while read-only (offline)", () => {
    setup({ readOnly: true })
    const add = screen.getByRole('button', { name: 'Add task to To Do' })
    expect(add).toBeDisabled()
    expect(add).toHaveAttribute('title', "Can't add tasks while offline")
  })

  it('opens a task by click, or by Enter on the focused card', async () => {
    const { user, onOpenTask } = setup()
    await user.click(screen.getByRole('heading', { name: 'Bravo' }))
    expect(onOpenTask).toHaveBeenLastCalledWith('b')

    const card = screen.getByRole('heading', { name: 'Charlie' }).closest('article')!
    expect(card).toHaveAttribute('aria-haspopup', 'dialog')
    card.focus()
    await user.keyboard('{Enter}')
    expect(onOpenTask).toHaveBeenLastCalledWith('c')
  })
})
