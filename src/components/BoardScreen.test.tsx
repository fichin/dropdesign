import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { ana, makeBoard, marko } from '../test/fixtures'
import BoardScreen from './BoardScreen'

// The real screen (views, filters, modal, sync) with only the network faked
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      listBoards: vi.fn(),
      getBoard: vi.fn(),
      moveTask: vi.fn(),
      updateTask: vi.fn(),
      addTask: vi.fn(),
      deleteTask: vi.fn(),
      listComments: vi.fn(),
      addComment: vi.fn(),
      deleteComment: vi.fn(),
    },
  }
})
const mocked = vi.mocked(api)

const board = () =>
  makeBoard({
    a: { title: 'Landing page copy', priority: 'high-priority', assignees: [ana] },
    b: { title: 'Pricing table', priority: 'important' },
    c: { title: 'Landing page images', priority: 'ok', assignees: [marko] },
    d: { title: 'API error alerts', priority: 'high-priority' },
    e: { title: 'Landing page launch', priority: 'meh' },
  })

async function setup() {
  const user = userEvent.setup()
  const result = render(<BoardScreen user={{ id: 'u', email: 'tester@example.com' }} onLogout={vi.fn()} onUnauthorized={vi.fn()} />)
  await screen.findByRole('tablist', { name: 'Board views' })
  return { user, ...result }
}

/** Task titles the current view shows, whatever its layout */
function shownTitles() {
  const panel = screen.getByRole('tabpanel')
  const table = within(panel).queryByRole('table')
  const titles = table
    ? within(table).getAllByRole('rowheader').map((cell) => cell.textContent)
    : within(panel).queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  return titles.toSorted()
}

// These render the whole screen and click through all four views: about 1-2s each on their
// own, but they can pass the 5s default when the machine (or a CI runner) is busy
describe('BoardScreen views', { timeout: 20_000 }, () => {
  beforeEach(() => {
    mocked.listBoards.mockResolvedValue([{ id: 'board', title: 'DropDesign' }])
    mocked.getBoard.mockResolvedValue(board())
    mocked.moveTask.mockResolvedValue({} as never)
    mocked.listComments.mockResolvedValue([])
  })

  it('shows the same tasks in all four views, and the panel follows the selected tab', async () => {
    const { user } = await setup()
    const all = ['API error alerts', 'Landing page copy', 'Landing page images', 'Landing page launch', 'Pricing table']
    for (const [tab, layout] of [
      ['Grid View', 'board-grid'],
      ['List View', null],
      ['Column View', 'board-column'],
      ['Row View', 'board-row'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: tab }))
      const panel = screen.getByRole('tabpanel')
      expect(panel).toHaveAccessibleName(tab)
      if (layout) expect(panel.querySelector(`.${layout}`)).not.toBeNull()
      else expect(within(panel).getByRole('table')).toBeInTheDocument()
      expect(shownTitles()).toEqual(all)
    }
  })

  it('applies the search and filters in every view', async () => {
    const { user } = await setup()
    await user.type(screen.getByRole('searchbox'), 'landing')
    await user.click(screen.getByRole('button', { name: /^Priority/ }))
    await user.click(screen.getByRole('checkbox', { name: 'High Priority' }))
    await user.click(screen.getByRole('checkbox', { name: 'OK' }))
    await user.keyboard('{Escape}')

    // "landing" AND (High Priority OR OK)
    for (const tab of ['Grid View', 'List View', 'Column View', 'Row View']) {
      await user.click(screen.getByRole('tab', { name: tab }))
      expect(shownTitles(), tab).toEqual(['Landing page copy', 'Landing page images'])
      expect(document.querySelector('.filter-count')).toHaveTextContent('2 of 5 tasks')
    }
  })

  it('remembers the view after a reload', async () => {
    const first = await setup()
    await first.user.click(screen.getByRole('tab', { name: 'Row View' }))
    first.unmount()

    await setup()
    expect(screen.getByRole('tab', { name: 'Row View' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel').querySelector('.board-row')).not.toBeNull()
  })

  it('changes status from the List view through the task modal', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('tab', { name: 'List View' }))
    await user.click(screen.getByRole('button', { name: 'Pricing table' }))
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Status' }), 'Completed')

    await waitFor(() => expect(mocked.moveTask).toHaveBeenCalledWith('b', { toColumnId: 'done', toIndex: 0 }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const row = screen.getByRole('row', { name: /Pricing table/ })
    expect(within(row).getByText('Completed')).toBeInTheDocument()
  })

  it('explains an empty board, in the board views and the List view', async () => {
    const empty = board()
    empty.tasks = {}
    for (const id of empty.columnOrder) empty.columns[id].taskIds = []
    mocked.getBoard.mockResolvedValue(empty)
    const { user } = await setup()

    expect(screen.getByText('This board has no tasks yet.')).toBeInTheDocument()
    expect(screen.getByText(/with the \+ button on any column/)).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getAllByText('No tasks yet')).toHaveLength(3) // each column

    await user.click(screen.getByRole('tab', { name: 'List View' }))
    expect(screen.getByText(/from the Grid, Column or Row view/)).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('No tasks yet')).toBeInTheDocument()
  })

  it('says when nothing matches the search and filters, with a way back', async () => {
    const { user } = await setup()
    await user.type(screen.getByRole('searchbox'), 'zzz-nothing')
    expect(screen.getByText('No tasks match your search and filters.')).toBeInTheDocument()

    // The board-level "Clear filters" (the filter bar has one too)
    const clear = screen.getAllByRole('button', { name: 'Clear filters' }).find((b) => b.closest('.board-empty'))!
    await user.click(clear)
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.queryByText('No tasks match your search and filters.')).not.toBeInTheDocument()
    expect(shownTitles()).toHaveLength(5)
  })

  it('shows no empty message while some tasks match', async () => {
    const { user } = await setup()
    await user.type(screen.getByRole('searchbox'), 'pricing')
    expect(screen.queryByText('No tasks match your search and filters.')).not.toBeInTheDocument()
    expect(screen.queryByText('This board has no tasks yet.')).not.toBeInTheDocument()
  })

  it('opens the same task modal from every view', async () => {
    const { user } = await setup()
    for (const tab of ['Grid View', 'Column View', 'Row View']) {
      await user.click(screen.getByRole('tab', { name: tab }))
      await user.click(within(screen.getByRole('tabpanel')).getByRole('heading', { name: 'API error alerts' }))
      expect(await screen.findByRole('dialog', { name: 'Task: API error alerts' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Close' }))
    }
    await user.click(screen.getByRole('tab', { name: 'List View' }))
    await user.click(screen.getByRole('button', { name: 'API error alerts' }))
    expect(await screen.findByRole('dialog', { name: 'Task: API error alerts' })).toBeInTheDocument()
  })

  it('gives focus back to the card or row that opened the task modal, in every view', async () => {
    const { user } = await setup()
    const closeWith = {
      'the Close button': () => user.click(screen.getByRole('button', { name: 'Close' })),
      // What the browser does on Escape: a cancel event on the dialog
      Escape: async () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true })),
      // The dialog element itself only receives clicks on its backdrop
      'a backdrop click': () => user.click(screen.getByRole('dialog')),
    }
    for (const tab of ['Grid View', 'List View', 'Column View', 'Row View']) {
      await user.click(screen.getByRole('tab', { name: tab }))
      const panel = screen.getByRole('tabpanel')
      // The card in the board views, the title button in the List view
      const opener =
        tab === 'List View'
          ? within(panel).getByRole('button', { name: 'Pricing table' })
          : within(panel).getByRole('heading', { name: 'Pricing table' }).closest('article')!
      for (const [closedWith, close] of Object.entries(closeWith)) {
        for (const openedWith of ['a click', 'Enter']) {
          if (openedWith === 'a click') {
            await user.click(opener)
          } else {
            act(() => opener.focus())
            await user.keyboard('{Enter}')
          }
          await screen.findByRole('dialog', { name: 'Task: Pricing table' })
          await close()
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
          expect(opener, `${tab}: opened with ${openedWith}, closed with ${closedWith}`).toHaveFocus()
        }
      }
    }
  })
})
