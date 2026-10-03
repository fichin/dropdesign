import type { Board, Comment, Priority, Task } from '../../shared/kanban.ts'

// Empty in development (Vite proxies /api to the backend); the API's URL in production
const API_URL = import.meta.env.VITE_API_URL ?? ''

/** The server answered with an error (`status`), or couldn't be reached at all (`status` 0) */
export class ApiError extends Error {
  readonly status: number
  /** For 400s: which fields were invalid and why (zod issues from the API) */
  readonly issues: { path: (string | number)[]; message: string }[]
  constructor(status: number, message: string, issues: ApiError['issues'] = []) {
    super(message)
    this.status = status
    this.issues = issues
  }

  /**
   * No connection, or a gateway saying the API is down/starting (Vite's dev proxy
   * answers 502 when the backend isn't running; hosts like Render use 502–504)
   */
  get unreachable() {
    return this.status === 0 || (this.status >= 502 && this.status <= 504)
  }
}

const UNREACHABLE_MESSAGE = 'Could not reach the server'

/**
 * Give up on a request after this long. Without a limit, one request that never answers
 * would hold up the board's save queue forever: later changes would show on screen but
 * never be saved, with no message. A timeout fails it like a lost connection instead.
 */
const REQUEST_TIMEOUT_MS = 15_000

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      // Send the session cookie (also cross-origin, when VITE_API_URL points elsewhere)
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    // No connection, or no answer in time
    throw new ApiError(0, UNREACHABLE_MESSAGE)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.issues)
    throw error.unreachable ? new ApiError(res.status, UNREACHABLE_MESSAGE) : error
  }
  return data as T
}

export interface User {
  id: string
  email: string
}

export const api = {
  me: () => request<User>('GET', '/auth/me'),
  login: (credentials: { email: string; password: string }) => request<User>('POST', '/auth/login', credentials),
  register: (credentials: { email: string; password: string }) =>
    request<User>('POST', '/auth/register', credentials),
  logout: () => request<null>('POST', '/auth/logout'),

  listBoards: () => request<{ id: string; title: string }[]>('GET', '/boards'),
  getBoard: (boardId: string) => request<Board>('GET', `/boards/${boardId}`),
  addTask: (boardId: string, task: { id: string; columnId: string; title: string }) =>
    request<Task>('POST', `/boards/${boardId}/tasks`, task),
  moveTask: (taskId: string, move: { toColumnId: string; toIndex: number }) =>
    request<{ task: Task; columns: Record<string, string[]> }>('PATCH', `/tasks/${taskId}/move`, move),
  updateTask: (
    taskId: string,
    changes: { title?: string; description?: string; priority?: Priority; assigneeIds?: string[] },
  ) => request<Task>('PATCH', `/tasks/${taskId}`, changes),
  deleteTask: (taskId: string) => request<{ columns: Record<string, string[]> }>('DELETE', `/tasks/${taskId}`),
  listComments: (taskId: string) => request<Comment[]>('GET', `/tasks/${taskId}/comments`),
  addComment: (taskId: string, comment: { id: string; body: string }) =>
    request<{ comment: Comment; commentCount: number }>('POST', `/tasks/${taskId}/comments`, comment),
  deleteComment: (commentId: string) =>
    request<{ taskId: string; commentCount: number }>('DELETE', `/comments/${commentId}`),
}
