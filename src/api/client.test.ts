import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

function respond(status: number, body?: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  )
}

/** The error a call rejects with */
async function errorFrom(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Expected the call to fail')
}

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the session cookie and a 15 second timeout with every request', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const fetch = respond(200, { id: 'board' })
    await api.getBoard('board')

    expect(timeout).toHaveBeenCalledWith(15_000)
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/boards\/board$/)
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('turns a lost connection or a timeout into an "unreachable" error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'))
    const error = await errorFrom(api.getBoard('board'))
    expect(error.status).toBe(0)
    expect(error.unreachable).toBe(true)
    expect(error.message).toBe('Could not reach the server')
  })

  it('treats gateway errors (API down or starting) as unreachable', async () => {
    respond(502, { error: 'Bad gateway' })
    const error = await errorFrom(api.getBoard('board'))
    expect(error.unreachable).toBe(true)
    expect(error.message).toBe('Could not reach the server')
  })

  it("passes on the API's message and field issues for other errors", async () => {
    respond(400, { error: 'Invalid input', issues: [{ path: ['email'], message: 'Enter a valid email' }] })
    const error = await errorFrom(api.getBoard('board'))
    expect(error.status).toBe(400)
    expect(error.unreachable).toBe(false)
    expect(error.message).toBe('Invalid input')
    expect(error.issues).toEqual([{ path: ['email'], message: 'Enter a valid email' }])
  })

  it('still fails cleanly when an error response has no JSON body', async () => {
    respond(500)
    const error = await errorFrom(api.getBoard('board'))
    expect(error.message).toBe('Request failed (500)')
  })
})
