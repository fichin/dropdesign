import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BoardPlaceholder, Notice, StatusBanner } from './SyncStatus'

describe('StatusBanner', () => {
  it('says it is connecting while showing the saved copy', () => {
    render(<StatusBanner status="loading" onRetry={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Connecting… showing your last saved copy.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('explains offline mode and offers a retry', async () => {
    const onRetry = vi.fn()
    render(<StatusBanner status="offline" onRetry={onRetry} />)
    expect(screen.getByRole('status')).toHaveTextContent("Can't reach the server")
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows nothing when live', () => {
    const { container } = render(<StatusBanner status="live" onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Notice', () => {
  it('announces a failed save in a live region and can be dismissed', async () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<Notice message={null} onDismiss={onDismiss} />)
    const region = screen.getByRole('alert')
    expect(region).toBeEmptyDOMElement() // mounted empty, so the message is announced when it appears

    rerender(<Notice message="Your last change couldn't be saved." onDismiss={onDismiss} />)
    expect(region).toHaveTextContent("Your last change couldn't be saved.")
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('BoardPlaceholder', () => {
  it('shows a skeleton board while loading, announced once to screen readers', () => {
    render(<BoardPlaceholder status="loading" error={null} onRetry={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Loading the board…')
    // The grey shapes are hidden from assistive technology
    const shapes = status.querySelectorAll('.skeleton-block')
    expect(shapes.length).toBeGreaterThan(5)
    for (const shape of shapes) expect(shape.closest('[aria-hidden="true"]')).not.toBeNull()
    // Three columns, like the real board
    expect(status.querySelectorAll('.skeleton-column')).toHaveLength(3)
  })

  it('explains a failed load and offers to try again', async () => {
    const onRetry = vi.fn()
    render(<BoardPlaceholder status="error" error="Could not reach the server" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the board")
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
