import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AddTaskForm from './AddTaskForm'

function setup() {
  const user = userEvent.setup()
  const onAdd = vi.fn()
  const onClose = vi.fn()
  render(<AddTaskForm onAdd={onAdd} onClose={onClose} />)
  return { user, onAdd, onClose, input: screen.getByRole('textbox', { name: 'Task title' }), add: screen.getByRole('button', { name: 'Add task' }) }
}

describe('AddTaskForm', () => {
  it('starts focused, with Add disabled until there is a title', async () => {
    const { user, input, add } = setup()
    expect(input).toHaveFocus()
    expect(add).toBeDisabled()
    await user.type(input, '   ')
    expect(add).toBeDisabled()
    await user.type(input, 'x')
    expect(add).toBeEnabled()
  })

  it('adds the task and closes', async () => {
    const { user, input, add, onAdd, onClose } = setup()
    await user.type(input, 'Plan the launch')
    await user.click(add)
    expect(onAdd).toHaveBeenCalledWith('Plan the launch')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes without adding on Cancel or Escape', async () => {
    const { user, input, onAdd, onClose } = setup()
    await user.type(input, 'Never mind{Escape}')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
