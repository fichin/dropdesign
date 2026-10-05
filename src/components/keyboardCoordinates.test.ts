import type { KeyboardCoordinateGetter } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'
import { kanbanKeyboardCoordinates, laneKeyboardCoordinates } from './keyboardCoordinates'

type Rect = { top: number; left: number; width: number; height: number; bottom: number; right: number }
const rect = (left: number, top: number, width = 100, height = 50): Rect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
})

/**
 * A fake drag context. columns: id -> cards, each with its rect. The active card is "a1".
 * Column nodes are real elements so document order (board order) can be compared.
 */
function contextFor(columns: Record<string, Record<string, Rect>>, columnRects: Record<string, Rect>) {
  const containers = Object.entries(columns).flatMap(([columnId, cards]) => {
    const node = document.createElement('section')
    document.body.append(node)
    const column = {
      id: columnId,
      key: columnId,
      disabled: false,
      node: { current: node },
      rect: { current: columnRects[columnId] },
      data: { current: { type: 'column', taskIds: Object.keys(cards) } },
    }
    const cardContainers = Object.entries(cards).map(([id, r]) => ({
      id,
      key: id,
      disabled: false,
      node: { current: document.createElement('article') },
      rect: { current: r },
      data: { current: { sortable: { containerId: columnId } } },
    }))
    return [column, ...cardContainers]
  })
  const rects = new Map<string, Rect>(containers.map((c) => [String(c.id), c.rect.current]))
  const byId = new Map(containers.map((c) => [String(c.id), c]))
  const active = byId.get('a1')!
  return {
    active: { id: 'a1', data: active.data, rect: { current: { initial: active.rect.current, translated: active.rect.current } } },
    collisionRect: active.rect.current,
    droppableRects: rects,
    droppableContainers: Object.assign(byId, { getEnabled: () => containers, toArray: () => containers }),
    over: null,
    scrollableAncestors: [],
  }
}

const press = (getter: KeyboardCoordinateGetter, code: string, context: ReturnType<typeof contextFor>) =>
  getter({ code, preventDefault() {} } as KeyboardEvent, {
    active: 'a1',
    currentCoordinates: { x: context.collisionRect.left, y: context.collisionRect.top },
    context: context as never,
  })

describe('keyboard moves in Row view (cards run left to right)', () => {
  // Two lanes stacked vertically: lane A at y=0, lane B at y=200
  const lanes = () =>
    contextFor(
      {
        laneA: { a1: rect(300, 10), a2: rect(420, 10) },
        laneB: { b1: rect(0, 210), b2: rect(120, 210), b3: rect(290, 210) },
      },
      { laneA: rect(0, 0, 800, 120), laneB: rect(0, 200, 800, 120) },
    )

  it('↓ goes to the next lane, next to the card at the same horizontal spot', () => {
    expect(press(laneKeyboardCoordinates, 'ArrowDown', lanes())).toEqual({ x: 290, y: 210 })
  })

  it('↑ in the first lane goes nowhere', () => {
    expect(press(laneKeyboardCoordinates, 'ArrowUp', lanes())).toBeUndefined()
  })

  it('→ stays in the same lane (reorders) instead of changing lanes', () => {
    const result = press(laneKeyboardCoordinates, 'ArrowRight', lanes())
    expect(result?.y).toBe(10)
  })
})

describe('keyboard moves in Grid and Column views (cards run top to bottom)', () => {
  // Two columns side by side: A at x=0, B at x=300
  const columns = () =>
    contextFor(
      {
        colA: { a1: rect(10, 200), a2: rect(10, 300) },
        colB: { b1: rect(310, 20), b2: rect(310, 190), b3: rect(310, 400) },
      },
      { colA: rect(0, 0, 120, 600), colB: rect(300, 0, 120, 600) },
    )

  it('→ goes to the next column, next to the card at the same height', () => {
    expect(press(kanbanKeyboardCoordinates, 'ArrowRight', columns())).toEqual({ x: 310, y: 190 })
  })

  it('← in the first column goes nowhere', () => {
    expect(press(kanbanKeyboardCoordinates, 'ArrowLeft', columns())).toBeUndefined()
  })
})
