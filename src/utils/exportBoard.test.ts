import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBoard } from '../test/fixtures'
import { exportBoard } from './exportBoard'

describe('exportBoard', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('downloads the board as a dated JSON file, then frees it', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T09:00:00Z'))
    const blobs: Blob[] = []
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob)
      return 'blob:fake'
    })
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('my-team-s-board-2026-10-06.json')
      expect(this.href).toBe('blob:fake')
    })

    const board = { ...makeBoard(), title: "My Team's Board!" }
    exportBoard(board)

    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    const data = JSON.parse(await blobs[0].text())
    expect(data).toMatchObject({ format: 'kanban-board', version: 1, exportedAt: '2026-10-06T09:00:00.000Z' })
    expect(data.board.columnOrder).toEqual(['todo', 'doing', 'done'])
    expect(Object.keys(data.board.tasks)).toHaveLength(5)

    // Freed only after the browser has had time to start the download
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith('blob:fake')
  })

  it('falls back to "board" for a title with no letters or digits', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^board-\d{4}-\d{2}-\d{2}\.json$/)
    })
    exportBoard({ ...makeBoard(), title: '★★★' })
    expect(click).toHaveBeenCalledOnce()
  })
})
