import { vi } from 'vitest'

/**
 * jsdom has no layout: every element measures 0×0, so a virtualized list would think its items
 * have no height and render all of them. This gives the elements `matches` picks a fixed height
 * (and everything else none), which is enough for the virtualizer to render a realistic window.
 * Undone by vi.restoreAllMocks() after each test.
 */
function mockHeight(height: number, matches: (element: HTMLElement) => boolean) {
  const heightOf = (element: HTMLElement) => (matches(element) ? height : 0)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const h = heightOf(this)
    return { x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: h, width: 1000, height: h, toJSON: () => ({}) }
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return heightOf(this)
  })
}

/** Table rows (the List view) */
export const mockRowHeight = (height: number) => mockHeight(height, (element) => element.tagName === 'TR')

/** The cards of a virtualized column (VirtualCards), measured on the element around each card */
export const mockCardHeight = (height: number) =>
  mockHeight(height, (element) => element.classList.contains('column-virtual-item'))

/** Scrolls the (layout-less) window: sets scrollY and fires the scroll event the virtualizer listens to */
export function scrollWindowTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
  window.dispatchEvent(new Event('scroll'))
}
