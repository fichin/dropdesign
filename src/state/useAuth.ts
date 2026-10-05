import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type User } from '../api/client'
import { clearCachedBoard } from './storage'

/**
 * - checking:  asking the server who's signed in
 * - signedIn:  the session cookie is valid
 * - signedOut: no valid session (reason says why, e.g. it expired)
 * - unknown:   the server couldn't be reached; the board screen handles that (offline copy)
 */
export type AuthState =
  | { status: 'checking' }
  | { status: 'signedIn'; user: User }
  | { status: 'signedOut'; reason?: string }
  | { status: 'unknown' }

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' })

  useEffect(() => {
    // Only settles the initial check: if the visitor has logged in (or used Try Demo) while
    // it was in flight, its answer is from before that session and must not replace it
    const settle = (next: AuthState) => setAuth((current) => (current.status === 'checking' ? next : current))
    api.me().then(
      (user) => settle({ status: 'signedIn', user }),
      (error) =>
        settle(error instanceof ApiError && error.status === 401 ? { status: 'signedOut' } : { status: 'unknown' }),
    )
  }, [])

  // login/register throw ApiError for the form to show; the server sets the cookie on success
  const login = useCallback(async (email: string, password: string) => {
    setAuth({ status: 'signedIn', user: await api.login({ email, password }) })
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    setAuth({ status: 'signedIn', user: await api.register({ email, password }) })
  }, [])

  /** "Try Demo": no credentials needed; throws ApiError for the page to show */
  const tryDemo = useCallback(async () => {
    setAuth({ status: 'signedIn', user: await api.loginDemo() })
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Even if the server can't be reached, sign out locally
    }
    clearCachedBoard()
    setAuth({ status: 'signedOut' })
  }, [])

  /** The API answered 401 (session missing or expired) */
  const sessionEnded = useCallback(() => {
    clearCachedBoard()
    setAuth((current) =>
      current.status === 'signedIn'
        ? { status: 'signedOut', reason: 'Your session has ended. Please log in again.' }
        : { status: 'signedOut' },
    )
  }, [])

  return { auth, login, register, tryDemo, logout, sessionEnded }
}
