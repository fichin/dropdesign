import { Component, type ErrorInfo, type ReactNode } from 'react'
import StatePage from './StatePage'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Replaces window.location.reload in tests */
  onReload?: () => void
}

/**
 * Catches errors thrown while rendering, so a bug shows a friendly page with a way out
 * instead of a blank screen. (Errors in event handlers and async code don't reach it;
 * those are handled where they happen, e.g. the save queue's notices.)
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected error:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const reload = this.props.onReload ?? (() => window.location.reload())
    return (
      <StatePage
        alert
        title="Something went wrong"
        actions={
          <>
            <button type="button" className="button-primary" onClick={reload}>
              Reload the page
            </button>
            {/* A full page load, so the app starts fresh */}
            <a href="/" className="button-secondary">
              Go to the board
            </a>
          </>
        }
      >
        <p>DropDesign hit an unexpected problem. Your saved changes are safe; reloading usually fixes it.</p>
      </StatePage>
    )
  }
}

export default ErrorBoundary
