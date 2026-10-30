import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from '../App'
import { saveCachedBoard } from '../state/storage'
import { makeBoard } from '../test/fixtures'
import { mockHeight } from '../test/layout'
import { afterNextPaint } from './measure'
import PerfShowcase from './PerfShowcase'

// No mocked API client here: every request the app could make goes through fetch, so a spy on
// fetch sees all of them. It answers like a signed-in server, for after leaving the demo
const realBoard = makeBoard()
let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input)
    const body =
      path === '/api/auth/me'
        ? { id: 'u', email: 'tester@example.com' }
        : path === '/api/boards'
          ? [{ id: realBoard.id, title: realBoard.title }]
          : path === `/api/boards/${realBoard.id}`
            ? realBoard
            : {}
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

// The panel's own live region (dnd-kit has one too)
const status = () => within(screen.getByRole('region', { name: 'How fast is the board?' })).getByRole('status')
const result = (name: string) => within(screen.getByRole('table')).getByRole('rowheader', { name }).nextElementSibling

describe('Performance demo', { timeout: 20_000 }, () => {
  // Builds 1,000- and 5,000-task boards and goes through every view: about 10s on its own, and
  // well over 20s while the other test files run alongside it
  const neverTalksToTheServer =
    "never talks to the server or touches the real board's saved data, and leaving brings the real board back"
  it(neverTalksToTheServer, { timeout: 60_000 }, async () => {
    // A signed-in user's offline copy and chosen view, as the real board leaves them
    saveCachedBoard(realBoard)
    localStorage.setItem('board-view', 'grid')
    const saved = { ...localStorage }

    // jsdom has no layout: give the virtualized cards and rows a height, as a browser would
    mockHeight(100, (element) => element.tagName === 'TR' || element.classList.contains('column-virtual-item'))
    window.history.replaceState(null, '', '/perf')
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(status()).toHaveTextContent('Rendered 1,000 tasks in the Column view in'), { timeout: 10_000 })
    expect(screen.getByRole('tab', { name: 'Column View' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: '5,000 tasks' }))
    await waitFor(() => expect(status()).toHaveTextContent('Rendered 5,000 tasks in the Column view in'), { timeout: 10_000 })
    expect(screen.getByRole('button', { name: '5,000 tasks' })).toHaveAttribute('aria-pressed', 'true')
    expect(result('Tasks on the board')).toHaveTextContent('5,000')
    // Virtualized: far fewer cards in the page than on the board
    const [shown] = result('Cards or rows rendered')!.textContent!.split(' of ')
    expect(Number(shown.replace(',', ''))).toBeLessThan(500)

    await user.click(screen.getByRole('tab', { name: 'List View' }))
    await waitFor(() => expect(status()).toHaveTextContent('Switched to the List view in'))
    await user.click(screen.getByRole('tab', { name: 'Grid View' }))
    await waitFor(() => expect(status()).toHaveTextContent("The Grid view isn't virtualized yet"))
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Row View' }))
    await waitFor(() => expect(status()).toHaveTextContent("The Row view isn't virtualized yet"))
    await user.click(screen.getByRole('button', { name: 'Switch to the Column view' }))
    await waitFor(() => expect(status()).toHaveTextContent('Switched to the Column view in'))

    // Changes stay in memory: add a task, and try to open one
    await user.click(screen.getByRole('button', { name: 'Add task to To Do' }))
    await user.type(screen.getByRole('textbox', { name: 'Task title' }), 'Made in the demo{Enter}')
    expect(await screen.findByRole('heading', { name: 'Made in the demo' })).toBeInTheDocument()
    await user.click(screen.getByRole('heading', { name: 'Made in the demo' }))
    expect(status()).toHaveTextContent('Task details are turned off in the demo')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect({ ...localStorage }).toEqual(saved)

    await user.click(screen.getByRole('button', { name: 'Leave demo' }))
    expect(window.location.pathname).toBe('/')
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/boards/board', expect.anything()))
    expect(await screen.findByRole('heading', { name: 'Task a' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Made in the demo' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Grid View' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect({ ...localStorage }).toEqual(saved))
  })

  it('shows every card in the Grid and Row views while the board is within their limit', async () => {
    const user = userEvent.setup()
    render(<PerfShowcase onLeave={vi.fn()} initialTasks={30} />)
    await waitFor(() => expect(status()).toHaveTextContent('Rendered 30 tasks'))
    for (const tab of ['Grid View', 'Row View']) {
      await user.click(screen.getByRole('tab', { name: tab }))
      await waitFor(() => expect(status()).toHaveTextContent(`Switched to the ${tab.split(' ')[0]} view in`))
      expect(within(screen.getByRole('tabpanel')).getAllByRole('heading', { level: 3 })).toHaveLength(30)
      expect(result(`${tab.split(' ')[0]} view virtualized`)).toHaveTextContent('No: every card is rendered')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('times picking up a card, and says so politely', async () => {
    const user = userEvent.setup()
    render(<PerfShowcase onLeave={vi.fn()} initialTasks={30} />)
    await waitFor(() => expect(status()).toHaveTextContent('Rendered 30 tasks'))
    expect(status()).toHaveAttribute('aria-live', 'polite')
    expect(result('Last card pick-up')).toHaveTextContent('Not yet')

    const card = within(screen.getByRole('tabpanel')).getAllByRole('heading', { level: 3 })[0].closest('article')!
    act(() => card.focus())
    await user.keyboard(' ')
    await waitFor(() => expect(status()).toHaveTextContent(/Picked up a card in \d+ ms \(keyboard\)/))
    expect(result('Last card pick-up')).toHaveTextContent(/\d+ ms \(keyboard\)/)
    await user.keyboard('{Escape}')
  })
})

describe('afterNextPaint', () => {
  it('resolves after the next animation frame, on the performance.now() clock', async () => {
    const frame = vi.fn()
    requestAnimationFrame(frame)
    const before = performance.now()
    const end = await afterNextPaint()
    expect(frame).toHaveBeenCalled()
    expect(end).toBeGreaterThanOrEqual(before)
  })
})
