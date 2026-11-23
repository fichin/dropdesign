import { useEffect, useRef } from 'react'

/**
 * Resolves with performance.now() once the browser has painted the next frame: requestAnimationFrame
 * runs just before style, layout and paint, and a message posted from it is handled right after
 * them. Called straight after a state update, it times React's render and commit plus the
 * browser's own work for that frame.
 */
export function afterNextPaint(): Promise<number> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = () => {
      port1.close()
      resolve(performance.now())
    }
    requestAnimationFrame(() => port2.postMessage(null))
  })
}

/** Every element in the page, the demo's own panel included */
export const countElements = () => document.getElementsByTagName('*').length

export interface PickupTiming {
  ms: number
  input: 'mouse' | 'touch' | 'keyboard'
}

/**
 * When the event happened, on the performance.now() clock. Browsers give event.timeStamp on that
 * clock; where it's on another one (jsdom counts from 1970), the time it's handled is used instead
 */
function eventTime(event: Event) {
  const now = performance.now()
  return event.timeStamp > 0 && event.timeStamp <= now ? event.timeStamp : now
}

/** Board's mouse sensor starts a drag once the pointer has moved more than this (MOUSE_OPTIONS) */
const MOUSE_DRAG_DISTANCE = 5

/**
 * Times picking up a card: from the input event that starts the drag (its timeStamp, so waiting
 * for a busy main thread counts too) to the first paint showing the lifted card (Board's
 * .drag-overlay). Mouse: the move that passes the 5px drag distance. Keyboard: the Space press.
 * Touch: the touchstart, so it includes Board's 250 ms press-and-hold.
 */
export function usePickupTiming(container: HTMLElement | null, onPickup: (timing: PickupTiming) => void) {
  const onPickupRef = useRef(onPickup)
  useEffect(() => {
    onPickupRef.current = onPickup
  }, [onPickup])

  useEffect(() => {
    if (!container) return
    let start: { time: number; input: PickupTiming['input'] } | null = null
    let mouseDown: { x: number; y: number } | null = null
    let lifted = false

    const onMouseDown = (event: MouseEvent) => {
      mouseDown = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
    }
    const onMouseMove = (event: MouseEvent) => {
      if (!mouseDown || lifted) return
      if (Math.hypot(event.clientX - mouseDown.x, event.clientY - mouseDown.y) > MOUSE_DRAG_DISTANCE) {
        start = { time: eventTime(event), input: 'mouse' }
        mouseDown = null
      }
    }
    const onTouchStart = (event: TouchEvent) => {
      if (!lifted) start = { time: eventTime(event), input: 'touch' }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !lifted) start = { time: eventTime(event), input: 'keyboard' }
    }
    const onUp = () => {
      mouseDown = null
    }

    // The lifted card appears in Board's DragOverlay, and disappears on drop or cancel
    const observer = new MutationObserver(() => {
      const isLifted = container.querySelector('.drag-overlay') !== null
      if (isLifted && !lifted && start) {
        const { time, input } = start
        void afterNextPaint().then((end) => onPickupRef.current({ ms: end - time, input }))
      }
      if (isLifted !== lifted) start = null
      lifted = isLifted
    })
    observer.observe(container, { childList: true, subtree: true })

    // Capture phase, so these run before the drag sensors handle the same events
    const options = { capture: true, passive: true }
    container.addEventListener('mousedown', onMouseDown, options)
    window.addEventListener('mousemove', onMouseMove, options)
    window.addEventListener('mouseup', onUp, options)
    container.addEventListener('touchstart', onTouchStart, options)
    container.addEventListener('keydown', onKeyDown, options)
    return () => {
      observer.disconnect()
      container.removeEventListener('mousedown', onMouseDown, options)
      window.removeEventListener('mousemove', onMouseMove, options)
      window.removeEventListener('mouseup', onUp, options)
      container.removeEventListener('touchstart', onTouchStart, options)
      container.removeEventListener('keydown', onKeyDown, options)
    }
  }, [container])
}
