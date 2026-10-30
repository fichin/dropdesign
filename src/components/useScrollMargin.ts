import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Where an element starts on the page (its distance from the top of the document), kept
 * current. Window virtualizers work in page coordinates, so they need it as `scrollMargin`.
 */
export function useScrollMargin(ref: RefObject<HTMLElement | null>) {
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setScrollMargin(element.getBoundingClientRect().top + window.scrollY)
    measure()
    // Anything above the element changing height (a status banner, the filter bar wrapping,
    // a longer column above it) moves it down the page, and every such change resizes the body
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(document.body)
    return () => observer?.disconnect()
  }, [ref])

  return scrollMargin
}
