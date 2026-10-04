import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board } from '../../shared/kanban.ts'
import { api, ApiError } from '../api/client'
import { ana, makeBoard } from '../test/fixtures'
import { saveCachedBoard } from './storage'
import { useBoardSync } from './useBoardSync'

// Only the network calls are faked; ApiError (and its "unreachable" rule) is the real one
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      listBoards: vi.fn(),
      getBoard: vi.fn(),
      addTask: vi.fn(),
      moveTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      listComments: vi.fn(),
      addComment: vi.fn(),
      deleteComment: vi.fn(),
    },
  }
})

const mocked = vi.mocked(api)

/** A promise the test resolves or rejects by hand, to control when the server answers */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const serverBoard = () => makeBoard()
const columnIds = (board: Board | null, columnId: string) => board?.columns[columnId].taskIds

/** Renders the hook and waits for the first load to finish */
async function setup() {
  const onUnauthorized = vi.fn()
  const hook = renderHook(() => useBoardSync({ onUnauthorized }))
  await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return { ...hook, onUnauthorized }
}

/** Lets queued promise callbacks (the save queue) run */
const flush = () => act(async () => {})

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocked.listBoards.mockResolvedValue([{ id: 'board', title: 'DropDesign' }] as never)
  mocked.getBoard.mockResolvedValue(serverBoard())
  for (const call of [mocked.addTask, mocked.moveTask, mocked.updateTask, mocked.deleteTask]) {
    call.mockResolvedValue({} as never)
  }
})

describe('useBoardSync: loading', () => {
  it('loads the board from the server and keeps an offline copy', async () => {
    const { result } = await setup()
    expect(result.current.status).toBe('live')
    expect(result.current.readOnly).toBe(false)
    expect(columnIds(result.current.board, 'todo')).toEqual(['a', 'b', 'c'])
    expect(localStorage.getItem('kanban-board')).toContain('"version":4')
  })

  it('shows the cached copy read-only when the server is unreachable', async () => {
    saveCachedBoard(serverBoard())
    mocked.getBoard.mockRejectedValue(new ApiError(0, 'Could not reach the server'))
    const { result } = await setup()
    expect(result.current.status).toBe('offline')
    expect(result.current.readOnly).toBe(true)
    expect(result.current.board).not.toBeNull()
  })

  it('reports an error when unreachable with nothing cached', async () => {
    mocked.getBoard.mockRejectedValue(new ApiError(0, 'Could not reach the server'))
    mocked.listBoards.mockRejectedValue(new ApiError(0, 'Could not reach the server'))
    const { result } = await setup()
    expect(result.current.status).toBe('error')
    expect(result.current.loadError).toBe('Could not reach the server')
  })

  it('hands over to sign-in on a 401', async () => {
    mocked.listBoards.mockRejectedValue(new ApiError(401, 'Not signed in'))
    const onUnauthorized = vi.fn()
    renderHook(() => useBoardSync({ onUnauthorized }))
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled())
  })
})

describe('useBoardSync: saving changes', () => {
  it('sends changes that have no callbacks (regression: 8638871 never sent them)', async () => {
    const { result } = await setup()
    act(() => result.current.moveTask('a', 'doing', 0))
    await flush()
    expect(mocked.moveTask).toHaveBeenCalledWith('a', { toColumnId: 'doing', toIndex: 0 })
  })

  it('shows a change immediately, before the server answers', async () => {
    const pending = deferred()
    mocked.moveTask.mockReturnValue(pending.promise as never)
    const { result } = await setup()

    act(() => result.current.moveTask('a', 'done', 0))
    expect(columnIds(result.current.board, 'done')).toEqual(['a', 'e'])
    expect(result.current.board?.tasks.a.progress).toBe(100)
    pending.resolve({})
  })

  it('sends changes one at a time, in order', async () => {
    const first = deferred()
    mocked.moveTask.mockReturnValueOnce(first.promise as never)
    const { result } = await setup()

    act(() => {
      result.current.moveTask('a', 'doing', 0)
      result.current.updateTask('b', { priority: 'meh' })
    })
    await flush()
    // The second waits for the first to be answered
    expect(mocked.moveTask).toHaveBeenCalledOnce()
    expect(mocked.updateTask).not.toHaveBeenCalled()

    await act(async () => first.resolve({}))
    await flush()
    expect(mocked.updateTask).toHaveBeenCalledWith('b', { priority: 'meh' })
  })

  it('sends what the API expects: trimmed titles, assignee ids', async () => {
    const { result } = await setup()
    act(() => result.current.updateTask('a', { title: '  New title ', assignees: [ana] }))
    await flush()
    expect(mocked.updateTask).toHaveBeenCalledWith('a', { title: 'New title', assigneeIds: ['u1'] })
  })

  it('does not send a change that changes nothing', async () => {
    const { result } = await setup()
    act(() => result.current.moveTask('b', 'todo', 1)) // already there
    await flush()
    expect(mocked.moveTask).not.toHaveBeenCalled()
  })

  it('refuses changes while read-only', async () => {
    saveCachedBoard(serverBoard())
    mocked.getBoard.mockRejectedValue(new ApiError(0, 'Could not reach the server'))
    const { result } = await setup()
    act(() => result.current.moveTask('a', 'doing', 0))
    await flush()
    expect(mocked.moveTask).not.toHaveBeenCalled()
    expect(columnIds(result.current.board, 'todo')).toEqual(['a', 'b', 'c'])
  })
})

describe('useBoardSync: when the server rejects a change', () => {
  it("reloads the server's board and says why", async () => {
    const { result } = await setup()
    mocked.moveTask.mockRejectedValueOnce(new ApiError(409, 'Task was deleted'))

    act(() => result.current.moveTask('a', 'doing', 0))
    await waitFor(() => expect(result.current.notice).toMatch(/couldn't be saved: Task was deleted/))
    // Back to what the server has
    expect(columnIds(result.current.board, 'todo')).toEqual(['a', 'b', 'c'])
    expect(result.current.status).toBe('live')
  })

  it('drops changes queued after the rejected one, and tells their callers', async () => {
    const first = deferred()
    mocked.moveTask.mockReturnValueOnce(first.promise as never)
    const { result } = await setup()
    const onError = vi.fn()
    mocked.addComment.mockResolvedValue({ comment: {} } as never)

    act(() => {
      result.current.moveTask('a', 'doing', 0)
      result.current.addComment('b', { id: 'c1', body: 'hi' }, { onSuccess: vi.fn(), onError })
    })
    await act(async () => first.reject(new ApiError(400, 'Invalid move')))
    await waitFor(() => expect(result.current.notice).not.toBeNull())

    // Made on top of a change that was undone: never sent
    expect(mocked.addComment).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('undoes the change and goes offline if the reload fails too', async () => {
    const { result } = await setup()
    mocked.moveTask.mockRejectedValueOnce(new ApiError(0, 'Could not reach the server'))
    mocked.getBoard.mockRejectedValue(new ApiError(0, 'Could not reach the server'))

    act(() => result.current.moveTask('a', 'doing', 0))
    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(result.current.notice).toMatch(/It was undone/)
    expect(columnIds(result.current.board, 'todo')).toEqual(['a', 'b', 'c'])
  })

  it('hands over to sign-in when a change gets a 401', async () => {
    const { result, onUnauthorized } = await setup()
    mocked.updateTask.mockRejectedValueOnce(new ApiError(401, 'Session expired'))
    act(() => result.current.updateTask('a', { priority: 'meh' }))
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled())
    expect(result.current.notice).toBeNull()
  })
})

describe('useBoardSync: comments', () => {
  it('counts a comment on the card right away and passes the saved comment back', async () => {
    const saved = { id: 'c1', body: 'hi' }
    mocked.addComment.mockResolvedValue({ comment: saved } as never)
    const { result } = await setup()
    const onSuccess = vi.fn()

    act(() => {
      result.current.addComment('a', { id: 'c1', body: 'hi' }, { onSuccess, onError: vi.fn() })
    })
    expect(result.current.board?.tasks.a.commentCount).toBe(1)
    await flush()
    expect(onSuccess).toHaveBeenCalledWith(saved)
  })
})
