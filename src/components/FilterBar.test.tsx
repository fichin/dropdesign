import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { useBoardFilters } from '../state/useBoardFilters'
import { ana, makeBoard, marko } from '../test/fixtures'
import FilterBar from './FilterBar'

const board = makeBoard({
  a: { title: 'Design landing page', priority: 'high-priority', assignees: [ana] },
  b: { title: 'Write API docs', priority: 'important', assignees: [marko] },
  c: { title: 'Fix login bug', priority: 'high-priority' },
})

/** FilterBar wired to the real filter hook, plus another field to type in */
function Harness() {
  const filters = useBoardFilters(board)
  const searchRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input aria-label="Some other field" />
      <FilterBar filters={filters} people={board.people} searchRef={searchRef} />
    </>
  )
}

function setup() {
  const user = userEvent.setup()
  render(<Harness />)
  const search = screen.getByRole('searchbox', { name: /search tasks/i })
  const count = () => screen.getByText(/tasks$/).textContent
  return { user, search, count }
}

describe('FilterBar', () => {
  it('shows how many tasks match as you type', async () => {
    const { user, search, count } = setup()
    expect(count()).toBe('5 tasks')
    await user.type(search, 'LANDING')
    expect(count()).toBe('1 of 5 tasks')
  })

  it('Escape in the search box clears it', async () => {
    const { user, search, count } = setup()
    await user.type(search, 'docs')
    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(count()).toBe('5 tasks')
  })

  it('Ctrl+K focuses search from anywhere, even while typing elsewhere', async () => {
    const { user, search } = setup()
    await user.click(screen.getByRole('textbox', { name: 'Some other field' }))
    await user.keyboard('{Control>}k{/Control}')
    expect(search).toHaveFocus()
  })

  it('"/" focuses search, but types normally inside another field', async () => {
    const { user, search } = setup()
    const other = screen.getByRole('textbox', { name: 'Some other field' })
    await user.click(other)
    await user.keyboard('/')
    expect(other).toHaveValue('/')
    expect(search).not.toHaveFocus()

    await user.click(document.body)
    await user.keyboard('/')
    expect(search).toHaveFocus()
    expect(search).toHaveValue('') // the slash itself isn't typed in
  })

  it('leaves the shortcuts alone while a dialog is open', async () => {
    const { user, search } = setup()
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    await user.keyboard('{Control>}k{/Control}')
    expect(search).not.toHaveFocus()
    dialog.remove()
  })

  it('filters by priority from the menu and shows the active count', async () => {
    const { user, count } = setup()
    await user.click(screen.getByRole('button', { name: /priority/i }))
    const menu = screen.getByRole('group', { name: 'Filter by priority' })
    await user.click(within(menu).getByRole('checkbox', { name: 'High Priority' }))

    expect(count()).toBe('2 of 5 tasks')
    expect(screen.getByTitle('Active filters')).toHaveTextContent('1')
  })

  it('closes a menu with Escape and returns focus to its button', async () => {
    const { user } = setup()
    const button = screen.getByRole('button', { name: /assignee/i })
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Filter by assignee' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes a menu when clicking outside it', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /assignee/i }))
    await user.click(document.body)
    expect(screen.queryByRole('group', { name: 'Filter by assignee' })).not.toBeInTheDocument()
  })

  it('"Clear filters" resets search and filters, then hides itself', async () => {
    const { user, search, count } = setup()
    await user.type(search, 'design')
    await user.click(screen.getByRole('button', { name: 'Overdue only' }))
    expect(screen.getByRole('button', { name: 'Overdue only' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(search).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Overdue only' })).toHaveAttribute('aria-pressed', 'false')
    expect(count()).toBe('5 tasks')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })
})
