import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, marko, sara } from '../test/fixtures'
import TopBar from './TopBar'

const team = [ana, marko, sara, { ...ana, id: 'u4', name: 'David Chen' }, { ...ana, id: 'u5', name: 'Elena Stojanova' }]

function setup(props: Partial<Parameters<typeof TopBar>[0]> = {}) {
  const user = userEvent.setup()
  const onLogout = vi.fn()
  const onSearch = vi.fn()
  render(<TopBar projectTitle="DropDesign" members={team} userEmail="filip@example.com" onLogout={onLogout} onSearch={onSearch} {...props} />)
  return { user, onLogout, onSearch }
}

describe('TopBar', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'light'
  })

  it('shows the breadcrumb with the project as the current page', () => {
    setup()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    const current = within(trail).getByText('DropDesign').closest('li')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('lists the team by name', () => {
    setup()
    const list = screen.getByRole('list', { name: 'Team: 5 people' })
    expect(within(list).getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(team.map((p) => p.name))
  })

  it('focuses the search from the search button', async () => {
    const { user, onSearch } = setup()
    await user.click(screen.getByRole('button', { name: 'Search tasks' }))
    expect(onSearch).toHaveBeenCalledOnce()
  })

  it('switches the theme', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('shows who is signed in and logs out', async () => {
    const { user, onLogout } = setup()
    expect(screen.getByText('filip@example.com')).toHaveAttribute('title', 'Signed in as filip@example.com')
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('leaves Invite as a placeholder that explains itself', async () => {
    const { user } = setup()
    const invite = screen.getByRole('button', { name: 'Invite' })
    expect(invite).toHaveAttribute('aria-disabled', 'true')
    expect(invite).toHaveAttribute('title', expect.stringMatching(/coming later/))
    invite.focus() // still focusable, so the explanation can be reached
    expect(invite).toHaveFocus()
    await user.click(invite) // and clicking does nothing harmful
  })

  it('works offline, without an email to show', () => {
    setup({ userEmail: undefined })
    expect(screen.queryByTitle(/Signed in as/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })
})
