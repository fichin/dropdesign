/**
 * jsdom has no matchMedia. This fake answers (prefers-color-scheme: dark) and can simulate
 * the user changing their system theme while the app is open.
 *
 * Listeners are kept across tests on purpose: the theme module subscribes once, when it's
 * first imported, just as it does in the browser.
 */
let systemDark = false
const listeners = new Set<(event: MediaQueryListEvent) => void>()

export function mockSystemTheme(dark: boolean) {
  systemDark = dark
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return query.includes('dark') ? systemDark : false
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as MediaQueryList
}

/** The OS theme changes while the page is open */
export function changeSystemTheme(dark: boolean) {
  systemDark = dark
  listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent))
}
