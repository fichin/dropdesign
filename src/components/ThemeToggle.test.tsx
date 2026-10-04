import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import ThemeToggle from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'light'
  })

  it('offers the other theme, switches to it, and remembers it', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle className="icon-button" />)

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    // The same button now offers light
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('updates when the theme is changed somewhere else', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeToggle className="icon-button" />
        <ThemeToggle className="auth-theme-toggle" />
      </>,
    )
    const [topBar, loginPage] = screen.getAllByRole('button', { name: 'Switch to dark theme' })
    await user.click(topBar)
    expect(loginPage).toHaveAccessibleName('Switch to light theme')
  })
})
