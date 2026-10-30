import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { mockSystemTheme } from './matchMedia'

// jsdom has no showModal. Like a browser's, this one opens the dialog and then focuses its
// first focusable element (React's autoFocus runs while the dialog is still closed, so on
// its own it has no effect)
// It also remembers what had focus, and close() gives focus back to it, as browsers do, but
// only while the dialog is still in the page: one already removed gives nothing back, so
// focus is left on <body>
const openedFrom = new WeakMap<HTMLDialogElement, Element | null>()
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    openedFrom.set(this, document.activeElement)
    this.setAttribute('open', '')
    this.querySelector<HTMLElement>(
      '[autofocus], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    )?.focus()
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    const opener = openedFrom.get(this)
    openedFrom.delete(this)
    if (this.isConnected && opener instanceof HTMLElement && opener.isConnected) opener.focus()
  }
}

// Before any test file is imported: the theme module reads matchMedia on import
mockSystemTheme(false)

beforeEach(() => {
  // A light system theme unless a test says otherwise
  mockSystemTheme(false)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  const root = document.documentElement
  delete root.dataset.theme
  root.removeAttribute('style')
  root.removeAttribute('class')
  vi.useRealTimers()
  vi.restoreAllMocks()
})
