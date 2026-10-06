import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Broken(): never {
  throw new Error('Kaboom')
}

describe('ErrorBoundary', () => {
  it('renders its children normally', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('replaces a crash with a friendly page, focused for screen readers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onReload = vi.fn()
    render(
      <ErrorBoundary onReload={onReload}>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Go to the board' })).toHaveAttribute('href', '/')

    await userEvent.click(screen.getByRole('button', { name: 'Reload the page' }))
    expect(onReload).toHaveBeenCalledOnce()
    // The error is still logged for debugging
    expect(consoleError).toHaveBeenCalledWith('Unexpected error:', expect.objectContaining({ message: 'Kaboom' }), expect.anything())
  })
})
