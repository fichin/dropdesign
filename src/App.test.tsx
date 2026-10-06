import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api/client'
import App from './App'
import { makeBoard } from './test/fixtures'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: { me: vi.fn(), login: vi.fn(), register: vi.fn(), loginDemo: vi.fn(), logout: vi.fn(), listBoards: vi.fn(), getBoard: vi.fn() },
  }
})
const mocked = vi.mocked(api)

function visit(path: string) {
  window.history.replaceState(null, '', path)
  return { user: userEvent.setup(), ...render(<App />) }
}

const signedOut = () => mocked.me.mockRejectedValue(new ApiError(401, 'Not signed in'))
const signedIn = () => mocked.me.mockResolvedValue({ id: 'u', email: 'tester@example.com' })

describe('App routing', () => {
  beforeEach(() => {
    mocked.listBoards.mockResolvedValue([{ id: 'board', title: 'DropDesign' }])
    mocked.getBoard.mockResolvedValue(makeBoard())
  })

  it('sends signed-out visitors from the board to the login page', async () => {
    signedOut()
    visit('/')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('sends signed-in visitors from the login page to the board', async () => {
    signedIn()
    visit('/login')
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(await screen.findByRole('tablist', { name: 'Board views' })).toBeInTheDocument()
  })

  it('shows a 404 page for unknown paths instead of redirecting', async () => {
    signedOut()
    const { user } = visit('/projects/nope')
    const heading = await screen.findByRole('heading', { name: 'Page not found' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('/projects/nope')).toBeInTheDocument()
    expect(document.title).toBe('Page not found · DropDesign')
    expect(window.location.pathname).toBe('/projects/nope') // the address isn't rewritten

    await user.click(screen.getByRole('link', { name: 'Go to the login page' }))
    expect(window.location.pathname).toBe('/login')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('offers the board from the 404 page once signed in', async () => {
    signedIn()
    const { user } = visit('/typo')
    const link = await screen.findByRole('link', { name: 'Go to the board' })
    expect(link).toHaveAttribute('href', '/')
    await user.click(link)
    expect(await screen.findByRole('tablist', { name: 'Board views' })).toBeInTheDocument()
  })

  it('follows the browser back button', async () => {
    signedOut()
    const { user } = visit('/login')
    await user.click(await screen.findByRole('link', { name: 'Create one' }))
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()

    act(() => {
      window.history.replaceState(null, '', '/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })
})
