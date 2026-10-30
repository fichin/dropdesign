import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Board as BoardType } from '../../shared/kanban.ts'
import { makeBoard, makeTask } from '../test/fixtures'
import { mockCardHeight, scrollWindowTo } from '../test/layout'
import Board, { type BoardLayout } from './Board'
import { VIRTUALIZE_COLUMN_FROM } from './VirtualCards'

const CARD_HEIGHT = 180
/** One card plus the gap below it */
const CARD_STEP = CARD_HEIGHT + 10

/** n tasks, "Task 0" to "Task n-1", in To Do; In Progress has one task, Completed none */
function longBoard(n: number): BoardType {
  const tasks = Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}`, makeTask(`t${i}`, { title: `Task ${i}` })]))
  const board = makeBoard()
  return {
    ...board,
    tasks: { ...tasks, d: board.tasks.d },
    columns: {
      todo: { ...board.columns.todo, taskIds: Object.keys(tasks) },
      doing: { ...board.columns.doing, taskIds: ['d'] },
      done: { ...board.columns.done, taskIds: [] },
    },
  }
}

function setup(n: number, layout: BoardLayout = 'column') {
  mockCardHeight(CARD_HEIGHT)
  // The virtualizer nudges the page when a measured card differs from its estimate; jsdom has no scrollTo
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const user = userEvent.setup()
  const onMoveTask = vi.fn()
  const onOpenTask = vi.fn()
  const view = render(
    <Board board={longBoard(n)} layout={layout} readOnly={false} onAddTask={() => {}} onMoveTask={onMoveTask} onOpenTask={onOpenTask} />,
  )
  const todo = screen.getByRole('region', { name: /To Do/ })
  /** Titles of the cards in To Do that are in the page, in page order */
  const titles = () => within(todo).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  const card = (title: string) => within(todo).getByRole('heading', { name: title }).closest('article')!
  return { user, onMoveTask, onOpenTask, view, todo, titles, card }
}

afterEach(() => scrollWindowTo(0))

describe('Board, Column view, long columns (virtualized)', () => {
  it('renders a column up to the threshold exactly as the Grid view does', { timeout: 20_000 }, () => {
    // dnd-kit numbers the id of its instructions per drag-and-drop context: the one difference
    // between two renders, whatever the layout
    const boardHtml = (view: ReturnType<typeof render>) =>
      view.container.querySelector('.board')!.innerHTML.replace(/DndDescribedBy-\d+/g, 'DndDescribedBy')
    const { view, titles } = setup(VIRTUALIZE_COLUMN_FROM)
    expect(titles()).toHaveLength(VIRTUALIZE_COLUMN_FROM)
    expect(view.container.querySelector('.column-virtual-list')).toBeNull()
    const columnHtml = boardHtml(view)
    view.unmount()

    const grid = setup(VIRTUALIZE_COLUMN_FROM, 'grid')
    expect(boardHtml(grid.view)).toBe(columnHtml)
  })

  it('renders only the cards near the screen in a longer column', () => {
    const { todo, titles } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    // jsdom's window is 768px tall: about 4 cards of 190px, plus 10 extra below
    expect(titles().length).toBeGreaterThan(10)
    expect(titles().length).toBeLessThan(30)
    expect(titles()[0]).toBe('Task 0')
    expect(titles()).not.toContain('Task 100')
    expect(todo.querySelector('.column-virtual-list')).toHaveStyle({ height: `${150 * CARD_STEP - 10}px` })
    // The column heading still counts every task, and the short column is rendered as before
    expect(within(todo).getByRole('heading', { level: 2 })).toHaveTextContent('To Do (150)')
    expect(screen.getByRole('region', { name: /In Progress/ }).querySelector('.column-virtual-list')).toBeNull()
  })

  it('renders the cards further down as the page scrolls', () => {
    const { titles } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    act(() => scrollWindowTo(80 * CARD_STEP))
    expect(titles()).toContain('Task 80')
    expect(titles()).not.toContain('Task 20')
  })

  it('keeps the card being dragged in the page when it scrolls away, and Escape cancels', async () => {
    const { user, onMoveTask, card } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    const dragged = card('Task 2')
    act(() => dragged.focus())
    await user.keyboard(' ')
    // Picked up: the card left in the list is the slot it will land in
    expect(dragged).toHaveClass('card-placeholder')

    act(() => scrollWindowTo(100 * CARD_STEP))
    expect(dragged).toBeInTheDocument()
    expect(dragged).toHaveClass('card-placeholder')

    await user.keyboard('{Escape}')
    expect(onMoveTask).not.toHaveBeenCalled()
    expect(document.querySelector('.card-placeholder')).toBeNull()
  })

  it('keeps the first and last cards in the page: where keyboard moves from other columns land', () => {
    const { titles } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    expect(titles()).toContain('Task 149')
    act(() => scrollWindowTo(80 * CARD_STEP))
    expect(titles()[0]).toBe('Task 0')
    expect(titles().at(-1)).toBe('Task 149')
  })

  it('keeps the focused card and its neighbours in the page when they scroll away', () => {
    const { titles, card } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    const focused = card('Task 5')
    act(() => focused.focus())
    act(() => scrollWindowTo(80 * CARD_STEP))
    expect(focused).toBeInTheDocument()
    expect(focused).toHaveFocus()
    // In column order: Tab and Shift+Tab from the focused card reach the cards next to it
    expect(titles().slice(0, 4)).toEqual(['Task 0', 'Task 4', 'Task 5', 'Task 6'])
    expect(titles()).not.toContain('Task 7')
  })

  it('keeps a picked-up card in the page after Escape, where it still has focus', async () => {
    const { user, card } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    const dragged = card('Task 2')
    act(() => dragged.focus())
    await user.keyboard(' ')
    act(() => scrollWindowTo(100 * CARD_STEP))
    await user.keyboard('{Escape}')
    expect(dragged).toBeInTheDocument()
    expect(dragged).not.toHaveClass('card-placeholder')
  })

  it('tells screen readers where each card sits in the whole column', () => {
    const { todo, card } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    const list = todo.querySelector<HTMLElement>('.column-virtual-list')!
    expect(list).toHaveAttribute('role', 'list')
    expect(list.querySelectorAll(':scope > [role="listitem"]').length).toBeLessThan(40)
    const item = (title: string) => card(title).closest('[role="listitem"]')
    expect(item('Task 0')).toHaveAttribute('aria-posinset', '1')
    expect(item('Task 3')).toHaveAttribute('aria-posinset', '4')
    expect(item('Task 149')).toHaveAttribute('aria-posinset', '150')
    expect(item('Task 3')).toHaveAttribute('aria-setsize', '150')
    // The card itself is unchanged: a button named by its content, with its title as a heading
    expect(card('Task 3')).toHaveAttribute('role', 'button')
    expect(within(card('Task 3')).getByRole('heading', { level: 3 })).toHaveTextContent('Task 3')
  })

  it('counts only the cards that match the filters', () => {
    mockCardHeight(CARD_HEIGHT)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    render(
      <Board
        board={longBoard(VIRTUALIZE_COLUMN_FROM + 50)}
        layout="column"
        readOnly={false}
        onAddTask={() => {}}
        onMoveTask={() => {}}
        onOpenTask={() => {}}
        isVisible={(task) => task.title.endsWith('0')}
        filtering
      />,
    )
    const todo = screen.getByRole('region', { name: /To Do/ })
    expect(within(todo).getByRole('heading', { level: 2 })).toHaveTextContent('To Do (15 of 150)')
    expect(within(todo).getAllByRole('listitem')[1]).toHaveAttribute('aria-setsize', '15')
    expect(within(todo).getAllByRole('listitem')[1]).toHaveAttribute('aria-posinset', '2')
  })

  it('opens a rendered card', async () => {
    const { user, onOpenTask, card } = setup(VIRTUALIZE_COLUMN_FROM + 50)
    await user.click(card('Task 3'))
    expect(onOpenTask).toHaveBeenCalledWith('t3')
  })

  it('still renders every card in the Grid and Row views', { timeout: 20_000 }, () => {
    for (const layout of ['grid', 'row'] as const) {
      const { view, titles } = setup(VIRTUALIZE_COLUMN_FROM + 50, layout)
      expect(titles()).toHaveLength(150)
      view.unmount()
    }
  })
})
