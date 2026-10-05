import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Comment } from '../../shared/kanban.ts'
import { ana, makeBoard, makeTask, marko } from '../test/fixtures'
import TaskModal from './TaskModal'

const board = makeBoard()
const currentUser = { id: 'user-1', email: 'filip.krstev@example.com' }

type AddCallbacks = { onSuccess: (saved: Comment) => void; onError: () => void }

const comment = (id: string, body: string, overrides: Partial<Comment> = {}): Comment => ({
  id,
  taskId: 'a',
  body,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  author: marko,
  authorUserId: 'someone-else',
  ...overrides,
})

/** Stands in for useBoardSync's comment functions; tests play the server through the callbacks */
function makeCommentSync(existing: Comment[] | Promise<Comment[]> = []) {
  const added: { taskId: string; comment: { id: string; body: string }; callbacks: AddCallbacks }[] = []
  return {
    added,
    loadComments: vi.fn(() => Promise.resolve(existing)),
    addComment: vi.fn((taskId: string, comment: { id: string; body: string }, callbacks: AddCallbacks) => {
      added.push({ taskId, comment, callbacks })
      return true
    }),
    deleteComment: vi.fn(() => true),
  }
}

function setup({ readOnly = false, comments = makeCommentSync(), task = makeTask('a', { title: 'Design landing page', assignees: [ana] }) } = {}) {
  const user = userEvent.setup()
  const props = {
    onUpdate: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  }
  render(
    <TaskModal
      task={task}
      column={board.columns.doing}
      columns={board.columnOrder.map((id) => board.columns[id])}
      people={board.people}
      readOnly={readOnly}
      currentUser={currentUser}
      comments={comments}
      {...props}
    />,
  )
  const dialog = screen.getByRole('dialog', { name: 'Task: Design landing page' })
  return { user, dialog, comments, ...props }
}

describe('TaskModal: open and close', () => {
  it('opens as a modal dialog with focus on Close', () => {
    const { dialog } = setup()
    expect(dialog).toHaveAttribute('open')
    expect(within(dialog).getByText('In Progress', { selector: '.task-modal-column' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('closes from the Close button', async () => {
    const { user, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape (the dialog cancel event) without letting the browser close it first', () => {
    const { dialog, onClose } = setup()
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on a backdrop click, but not on clicks inside', async () => {
    const { user, dialog, onClose } = setup()
    await user.click(screen.getByText('In Progress', { selector: '.task-modal-column' }))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(dialog) // the dialog element itself only receives backdrop clicks
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('saves a title still being typed when it closes', async () => {
    const { user, onUpdate, onClose } = setup()
    const title = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Landing page v2')
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Landing page v2' })
    expect(onClose).toHaveBeenCalled()
  })

  it('puts the old title back instead of saving an empty one', async () => {
    const { user, onUpdate } = setup()
    const title = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.tab()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(title).toHaveValue('Design landing page')
  })
})

describe('TaskModal: editing', () => {
  it('changes the status (moves the task to another column)', async () => {
    const { user, onMove } = setup()
    const status = screen.getByRole('combobox', { name: 'Status' })
    expect(status).toHaveValue('doing')
    expect(screen.getAllByRole('option', { name: /To Do|In Progress|Completed/ }).map((o) => o.textContent)).toEqual(['To Do', 'In Progress', 'Completed'])
    await user.selectOptions(status, 'Completed')
    expect(onMove).toHaveBeenCalledWith('done')
  })

  it('changes the priority', async () => {
    const { user, onUpdate } = setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'Meh')
    expect(onUpdate).toHaveBeenCalledWith({ priority: 'meh' })
  })

  it('adds and removes assignees', async () => {
    const { user, onUpdate } = setup()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add a person' }), 'Marko Ilievski')
    expect(onUpdate).toHaveBeenLastCalledWith({ assignees: [ana, marko] })
    await user.click(screen.getByRole('button', { name: 'Remove Ana Petrova' }))
    expect(onUpdate).toHaveBeenLastCalledWith({ assignees: [] })
  })

  it('asks before deleting, with focus on Cancel', async () => {
    const { user, onDelete, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent("Delete this task? This can't be undone.")
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("doesn't offer deleting to the demo account", () => {
    render(
      <TaskModal
        task={makeTask('a', { title: 'Design landing page' })}
        column={board.columns.doing}
        columns={board.columnOrder.map((id) => board.columns[id])}
        people={board.people}
        readOnly={false}
        currentUser={{ ...currentUser, demo: true }}
        comments={makeCommentSync()}
        onUpdate={vi.fn()}
        onMove={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const remove = screen.getByRole('button', { name: 'Delete task' })
    expect(remove).toBeDisabled()
    expect(remove).toHaveAttribute('title', "The demo account can't delete tasks")
    // Everything else stays editable
    expect(screen.getByRole('combobox', { name: 'Priority' })).toBeEnabled()
  })

  it('is view-only while offline', async () => {
    const { user, onUpdate } = setup({ readOnly: true })
    expect(screen.getByRole('status')).toHaveTextContent("You're offline")
    expect(screen.getByRole('combobox', { name: 'Priority' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete task' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Write a comment' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'x')
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

describe('TaskModal: comments', () => {
  it('shows the comments loaded for the task', async () => {
    const comments = makeCommentSync([comment('c1', 'Looks great')])
    setup({ comments })
    const body = await screen.findByText('Looks great')
    const item = body.closest('li')!
    expect(within(item).getByText('Marko Ilievski')).toBeInTheDocument()
    // Someone else's comment: no delete option
    expect(within(item).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(comments.loadComments).toHaveBeenCalledWith('a')
  })

  it('posts a comment: shown straight away as sending, then confirmed', async () => {
    const comments = makeCommentSync()
    const { user } = setup({ comments })
    await screen.findByText('No comments yet.')

    await user.type(screen.getByRole('textbox', { name: 'Write a comment' }), '  Ship it  ')
    await user.click(screen.getByRole('button', { name: 'Comment' }))

    expect(comments.addComment).toHaveBeenCalledOnce()
    const [{ taskId, comment: sent, callbacks }] = comments.added
    expect(taskId).toBe('a')
    expect(sent.body).toBe('Ship it') // trimmed
    // Optimistic: visible before the server answers, under a name made from the email
    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText('Sending…')).toBeInTheDocument()
    expect(screen.getByText('Filip Krstev')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Write a comment' })).toHaveValue('')

    act(() => callbacks.onSuccess(comment(sent.id, 'Ship it', { author: ana, authorUserId: currentUser.id })))
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument()
    // Now it's a saved comment of yours, so it can be deleted
    expect(screen.getByRole('button', { name: /delete your comment/i })).toBeInTheDocument()
  })

  it('removes the comment again if the server rejects it', async () => {
    const comments = makeCommentSync()
    const { user } = setup({ comments })
    await user.type(screen.getByRole('textbox', { name: 'Write a comment' }), 'Will fail')
    await user.click(screen.getByRole('button', { name: 'Comment' }))
    act(() => comments.added[0].callbacks.onError())
    expect(screen.queryByText('Will fail')).not.toBeInTheDocument()
  })

  it('sends with Ctrl+Enter', async () => {
    const comments = makeCommentSync()
    const { user } = setup({ comments })
    await user.type(screen.getByRole('textbox', { name: 'Write a comment' }), 'Quick note{Control>}{Enter}{/Control}')
    expect(comments.addComment).toHaveBeenCalledOnce()
    expect(comments.added[0].comment.body).toBe('Quick note')
  })

  it('will not send blank or over-long comments', async () => {
    const { user } = setup()
    const box = screen.getByRole('textbox', { name: 'Write a comment' })
    const send = screen.getByRole('button', { name: 'Comment' })
    await user.type(box, '   ')
    expect(send).toBeDisabled()

    fireEvent.change(box, { target: { value: 'x'.repeat(2001) } })
    expect(send).toBeDisabled()
    expect(screen.getByText('2001 / 2000 characters')).toBeInTheDocument()
    expect(box).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps a just-posted comment when an older list arrives from the server', async () => {
    // Regression: a comment list requested before posting used to replace the new comment
    let answer!: (list: Comment[]) => void
    const comments = makeCommentSync(new Promise<Comment[]>((resolve) => (answer = resolve)))
    const { user } = setup({ comments })

    await user.type(screen.getByRole('textbox', { name: 'Write a comment' }), 'Posted while loading')
    await user.click(screen.getByRole('button', { name: 'Comment' }))
    await act(async () => answer([comment('c1', 'Older comment')]))

    expect(screen.getByText('Older comment')).toBeInTheDocument()
    expect(screen.getByText('Posted while loading')).toBeInTheDocument()
  })
})
