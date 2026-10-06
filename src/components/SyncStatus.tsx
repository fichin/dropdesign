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
  return <BoardSkeleton />
}

/** Cards per column in the skeleton, roughly the shape of a real board */
const SKELETON_CARDS = [3, 2, 2]

/**
 * The board's outline while it loads. Screen readers hear "Loading the board…" once; the
 * grey shapes are hidden from them.
 */
function BoardSkeleton() {
  return (
    <div className="board-skeleton" role="status" aria-busy="true">
      <span className="visually-hidden">Loading the board…</span>
      <div className="skeleton-header" aria-hidden="true">
        <span className="skeleton-block skeleton-icon" />
        <div className="skeleton-heading">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-tabs" />
        </div>
      </div>
      <div className="skeleton-filters" aria-hidden="true">
        <span className="skeleton-block skeleton-search" />
        <span className="skeleton-block skeleton-chip" />
        <span className="skeleton-block skeleton-chip" />
      </div>
      <div className="skeleton-columns" aria-hidden="true">
        {SKELETON_CARDS.map((cards, column) => (
          <div key={column} className="skeleton-column">
            <span className="skeleton-block skeleton-column-title" />
            {Array.from({ length: cards }, (_, card) => (
              <div key={card} className="skeleton-card">
                <span className="skeleton-block skeleton-pill" />
                <span className="skeleton-block skeleton-line" />
                <span className="skeleton-block skeleton-line skeleton-line-short" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
