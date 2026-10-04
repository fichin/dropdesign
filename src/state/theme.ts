import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

// The inline script in index.html reads the same key to apply the theme before React mounts
const STORAGE_KEY = 'theme'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (root.dataset.theme === theme) return
  // Switch everything at once: without this, elements with colour transitions (columns,
  // inputs) would fade while the rest snaps
  root.classList.add('theme-switching')
  root.dataset.theme = theme
  root.style.colorScheme = theme
  void root.offsetHeight // apply the new colours with transitions still off
  root.classList.remove('theme-switching')
  listeners.forEach((listener) => listener())
}

/** The saved choice, or the system setting until the user has made one */
function syncTheme() {
  applyTheme(savedTheme() ?? (systemDark.matches ? 'dark' : 'light'))
}

// Module-level rather than in a component, so it also works on the login page
systemDark.addEventListener('change', syncTheme)
// Toggled in another tab
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) syncTheme()
})

/** Apply and remember the user's choice */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (e.g. blocked): the theme still applies, it just isn't remembered
  }
  applyTheme(theme)
}

export function useTheme(): Theme {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, currentTheme)
}
