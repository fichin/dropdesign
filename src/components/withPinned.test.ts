import { describe, expect, it } from 'vitest'
import { withPinned } from './withPinned'

describe('withPinned', () => {
  it('keeps the visible range as it is when every pin is already in it', () => {
    const visible = [4, 5, 6, 7]
    expect(withPinned(visible, [5, 7], 100)).toBe(visible)
  })

  it('adds pins outside the range, in list order', () => {
    expect(withPinned([40, 41, 42], [0, 99, 7], 100)).toEqual([0, 7, 40, 41, 42, 99])
  })

  it('ignores missing (-1) and out-of-range pins, and duplicates', () => {
    expect(withPinned([2, 3], [-1, 100, 3, 0, 0], 100)).toEqual([0, 2, 3])
  })
})
