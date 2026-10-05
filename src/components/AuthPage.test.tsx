import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import AuthPage from './AuthPage'

function setup(onTryDemo = vi.fn(() => Promise.resolve())) {
  const user = userEvent.setup()
  const onSubmit = vi.fn(() => Promise.resolve())
  render(<AuthPage mode="login" onSubmit={onSubmit} onSwitchMode={vi.fn()} onTryDemo={onTryDemo} />)
  return { user, onSubmit, onTryDemo }
}

describe('AuthPage: Try Demo', () => {
  it('signs in with one click, no credentials typed', async () => {
    const { user, onTryDemo, onSubmit } = setup()
    await user.click(screen.getByRole('button', { name: 'Try Demo' }))
    expect(onTryDemo).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps the regular login form working alongside it', async () => {
    const { user, onSubmit } = setup()
    await user.type(screen.getByLabelText('Email'), 'demo@example.com')
    await user.type(screen.getByLabelText('Password'), 'try-dropdesign')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(onSubmit).toHaveBeenCalledWith('demo@example.com', 'try-dropdesign')
  })

  it('shows progress and blocks double clicks while the demo opens', async () => {
    let finish!: () => void
    const { user, onTryDemo } = setup(vi.fn(() => new Promise<void>((resolve) => (finish = resolve))))
    await user.click(screen.getByRole('button', { name: 'Try Demo' }))
    const button = screen.getByRole('button', { name: 'Opening the demo…' })
    expect(button).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled()
    await user.click(button)
    expect(onTryDemo).toHaveBeenCalledOnce()
    await act(async () => finish())
  })

  it('explains when the demo is not available', async () => {
    const { user } = setup(vi.fn(() => Promise.reject(new ApiError(404, "The demo isn't set up on this server"))))
    await user.click(screen.getByRole('button', { name: 'Try Demo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The demo isn't available on this server.")
    expect(screen.getByRole('button', { name: 'Try Demo' })).toBeEnabled()
  })

  it('explains when the server cannot be reached', async () => {
    const { user } = setup(vi.fn(() => Promise.reject(new ApiError(0, 'Could not reach the server'))))
    await user.click(screen.getByRole('button', { name: 'Try Demo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
  })
})
