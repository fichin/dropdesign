import type { SyncStatus } from '../state/useBoardSync'
import './SyncStatus.css'

interface StatusBannerProps {
  status: SyncStatus
  onRetry: () => void
}

/** Shown above the board while it's a cached copy rather than live server data */
export function StatusBanner({ status, onRetry }: StatusBannerProps) {
  if (status === 'live' || status === 'error') return null
  const offline = status === 'offline'
  return (
    <div className={offline ? 'status-banner status-banner-offline' : 'status-banner'} role="status">
      <span className="status-dot" aria-hidden="true" />
      <span>
        {offline
          ? "Can't reach the server. Showing your last saved copy; changes are paused until you're back online."
          : 'Connecting… showing your last saved copy.'}
      </span>
      {offline && (
        <button type="button" className="button-secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

interface NoticeProps {
  message: string | null
  onDismiss: () => void
}

/** A change that couldn't be saved */
export function Notice({ message, onDismiss }: NoticeProps) {
  // Kept mounted so screen readers announce the message when it appears
  return (
    <div className="notice-region" role="alert">
      {message && (
        <div className="notice">
          <span>{message}</span>
          <button type="button" className="notice-dismiss" aria-label="Dismiss" onClick={onDismiss}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}

interface BoardPlaceholderProps {
  status: SyncStatus
  error: string | null
  onRetry: () => void
}

/** Shown instead of the board when there's nothing (not even a cached copy) to show yet */
export function BoardPlaceholder({ status, error, onRetry }: BoardPlaceholderProps) {
  if (status === 'error') {
    return (
      <div className="board-placeholder" role="alert">
        <h1>Couldn't load the board</h1>
        <p>{error ?? 'The server could not be reached.'}</p>
        <button type="button" className="button-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  return (
    <div className="board-placeholder" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>Loading board…</p>
    </div>
  )
}
