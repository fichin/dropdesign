import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, type User } from '../api/client'
import { useAuth } from './useAuth'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, api: { me: vi.fn(), login: vi.fn(), register: vi.fn(), loginDemo: vi.fn(), logout: vi.fn() } }
})
const mocked = vi.mocked(api)
const demoUser: User = { id: 'demo-id', email: 'demo@example.com', demo: true }

/** A promise the test settles by hand, to control the order answers arrive in */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

describe('useAuth', () => {
  beforeEach(() => {
    mocked.loginDemo.mockResolvedValue(demoUser)
    mocked.login.mockResolvedValue(demoUser)
  })

  it('starts signed out when the session check says 401', async () => {
    mocked.me.mockRejectedValue(new ApiError(401, 'Not signed in'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.auth.status).toBe('signedOut'))
  })

  it('Try Demo signs in as the demo account', async () => {
    mocked.me.mockRejectedValue(new ApiError(401, 'Not signed in'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.auth.status).toBe('signedOut'))
    await act(() => result.current.tryDemo())
    expect(result.current.auth).toEqual({ status: 'signedIn', user: demoUser })
  })

  // Regression (found testing production): the page-load session check can be slow (a
  // serverless cold start). If its 401 arrived after a quick Try Demo or login, it replaced
  // the new session and sent the visitor back to the login page
  it.each([
    ['Try Demo', (auth: ReturnType<typeof useAuth>) => auth.tryDemo()],
    ['logging in', (auth: ReturnType<typeof useAuth>) => auth.login('demo@example.com', 'try-dropdesign')],
  ])('a slow session check does not undo %s', async (_name, signIn) => {
    const check = deferred<User>()
    mocked.me.mockReturnValue(check.promise)
    const { result } = renderHook(() => useAuth())

    await act(() => signIn(result.current))
    expect(result.current.auth.status).toBe('signedIn')

    // The check from page load answers last, from before the session existed
    await act(async () => check.reject(new ApiError(401, 'Not signed in')))
    expect(result.current.auth).toEqual({ status: 'signedIn', user: demoUser })
  })
})
