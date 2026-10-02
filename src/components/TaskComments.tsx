import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Comment } from '../../shared/kanban.ts'
import { initialsAvatar, nameFromEmail } from '../../shared/people.ts'
import type { User } from '../api/client'
import type { BoardSync } from '../state/useBoardSync'
import { loadCachedComments, saveCachedComments } from '../state/storage'
import { CommentIcon } from './icons'

const OFFLINE_HINT = "Can't edit while offline"
const MAX_LENGTH = 2000

/** A comment shown before the server has confirmed it */
type ShownComment = Comment & { pending?: boolean }

interface TaskCommentsProps {
  taskId: string
  commentCount: number
  /** The signed-in user (unknown while offline): their comments get a delete option */
  currentUser?: User
  readOnly: boolean
  sync: Pick<BoardSync, 'loadComments' | 'addComment' | 'deleteComment'>
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

const dateOnly = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", then a date after a week */
function timeAgo(iso: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000) // negative: in the past
  const age = Math.abs(seconds)
  if (age < 45) return 'just now'
  if (age < 3600) return relativeTime.format(Math.round(seconds / 60), 'minute')
  if (age < 86400) return relativeTime.format(Math.round(seconds / 3600), 'hour')
  if (age < 7 * 86400) return relativeTime.format(Math.round(seconds / 86400), 'day')
  return dateOnly.format(new Date(iso))
}

/**
 * The comment list and form in the task modal. Comments load per task (they aren't part
 * of the board); adding and deleting go through the board's change queue, so they're
 * optimistic, ordered with other edits, and rolled back if the server says no.
 */
function TaskComments({ taskId, commentCount, currentUser, readOnly, sync }: TaskCommentsProps) {
  // The sync object itself is new on every render; these functions are stable
  const { loadComments, addComment, deleteComment } = sync
  const [comments, setComments] = useState<ShownComment[] | null>(() => loadCachedComments(taskId))
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [draft, setDraft] = useState('')
  // Posts and deletes made here. A list from the server can be older than those (it was
  // requested before they were sent or saved), so they're reapplied on top of it
  const postedIds = useRef(new Set<string>())
  const deletedIds = useRef(new Set<string>())

  /** Updates the list and keeps the offline copy in step (only confirmed comments are saved) */
  const updateComments = useCallback(
    (update: (current: ShownComment[]) => ShownComment[]) => {
      setComments((current) => {
        const next = update(current ?? [])
        saveCachedComments(
          taskId,
          next.filter((c) => !c.pending).map(({ pending: _pending, ...comment }) => comment),
        )
        return next
      })
    },
    [taskId],
  )

  const load = useCallback(() => {
    let stillWanted = true
    loadComments(taskId).then(
      (fresh) => {
        if (!stillWanted) return
        // The server's list (everyone else's comments), plus our posts it doesn't have yet,
        // minus our deletes it may still include
        updateComments((current) => {
          const merged: ShownComment[] = fresh.filter((c) => !deletedIds.current.has(c.id))
          const onServer = new Set(merged.map((c) => c.id))
          for (const comment of current) {
            if (postedIds.current.has(comment.id) && !onServer.has(comment.id)) merged.push(comment)
          }
          return merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        })
        setLoadState('ready')
      },
      // A 401 is handled by the sync (redirect to login); anything else keeps the cached copy
      () => stillWanted && setLoadState('failed'),
    )
    // Unmounted (or reloaded) before it answered: ignore the answer
    return () => {
      stillWanted = false
    }
  }, [loadComments, taskId, updateComments])

  useEffect(load, [load])

  function post(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || readOnly || !currentUser) return

    const id = crypto.randomUUID()
    // Shown straight away as the server will create it: same name and initials avatar
    const name = nameFromEmail(currentUser.email)
    const placeholder: ShownComment = {
      id,
      taskId,
      body,
      createdAt: new Date().toISOString(),
      author: { id: `pending-${currentUser.id}`, name, avatarUrl: initialsAvatar(name) },
      authorUserId: currentUser.id,
      pending: true,
    }
    const sent = addComment(taskId, { id, body }, {
      onSuccess: (saved) => updateComments((list) => list.map((c) => (c.id === id ? saved : c))),
      onError: () => {
        postedIds.current.delete(id)
        updateComments((list) => list.filter((c) => c.id !== id))
      },
    })
    if (sent) {
      postedIds.current.add(id)
      updateComments((list) => [...list, placeholder])
      setDraft('')
    }
  }

  function remove(comment: ShownComment) {
    const index = comments?.findIndex((c) => c.id === comment.id) ?? -1
    const sent = deleteComment(taskId, comment.id, {
      onSuccess: () => {},
      // Put it back where it was
      onError: () => {
        deletedIds.current.delete(comment.id)
        updateComments((list) =>
          list.some((c) => c.id === comment.id) ? list : [...list.slice(0, index), comment, ...list.slice(index)],
        )
      },
    })
    if (sent) {
      deletedIds.current.add(comment.id)
      updateComments((list) => list.filter((c) => c.id !== comment.id))
    }
  }

  const canWrite = !readOnly && !!currentUser
  const tooLong = draft.length > MAX_LENGTH

  return (
    <section className="task-modal-section task-comments" aria-labelledby="comments-heading">
      <h3 id="comments-heading" className="task-modal-label">
        <CommentIcon /> Comments ({commentCount})
      </h3>

      {loadState === 'loading' && comments === null && <p className="comments-status">Loading comments…</p>}
      {loadState === 'failed' && (
        <p className="comments-status" role="status">
          {comments === null ? "Comments couldn't be loaded." : 'Showing the comments saved on this device.'}{' '}
          {!readOnly && (
            <button type="button" className="comments-retry" onClick={() => load()}>
              Try again
            </button>
          )}
        </p>
      )}

      {comments && comments.length === 0 && loadState !== 'loading' && (
        <p className="comments-status">No comments yet.</p>
      )}

      {comments && comments.length > 0 && (
        <ol className="comment-list">
          {comments.map((comment) => {
            const mine = !!currentUser && comment.authorUserId === currentUser.id
            const ago = timeAgo(comment.createdAt)
            return (
              <li key={comment.id} className={comment.pending ? 'comment comment-pending' : 'comment'} aria-busy={comment.pending}>
                <img className="comment-avatar" src={comment.author.avatarUrl} alt="" />
                <div className="comment-main">
                  <div className="comment-meta">
                    <span className="comment-author">
                      {comment.author.name}
                      {mine && <span className="comment-you"> (you)</span>}
                    </span>
                    <time dateTime={comment.createdAt} title={fullDate.format(new Date(comment.createdAt))}>
                      {ago}
                    </time>
                    {comment.pending && <span className="comment-sending">Sending…</span>}
                    {mine && !comment.pending && (
                      <button
                        type="button"
                        className="comment-delete"
                        aria-label={`Delete your comment from ${ago}`}
                        disabled={readOnly}
                        title={readOnly ? OFFLINE_HINT : undefined}
                        onClick={() => remove(comment)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="comment-body">{comment.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <form className="comment-form" onSubmit={post}>
        <label className="visually-hidden" htmlFor="new-comment">
          Write a comment
        </label>
        <textarea
          id="new-comment"
          className="task-modal-description comment-input"
          rows={3}
          placeholder={canWrite ? 'Write a comment…' : 'Comments can be added when you’re back online'}
          value={draft}
          disabled={!canWrite}
          title={canWrite ? undefined : OFFLINE_HINT}
          aria-invalid={tooLong}
          aria-describedby="comment-hint"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Ctrl/Cmd+Enter sends
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.currentTarget.form?.requestSubmit()
          }}
        />
        <div className="comment-form-actions">
          <span id="comment-hint" className={tooLong ? 'comment-hint comment-hint-error' : 'comment-hint'}>
            {tooLong ? `${draft.length} / ${MAX_LENGTH} characters` : 'Ctrl + Enter to send'}
          </span>
          <button
            type="submit"
            className="button-primary"
            disabled={!canWrite || !draft.trim() || tooLong}
            title={canWrite ? undefined : OFFLINE_HINT}
          >
            Comment
          </button>
        </div>
      </form>
    </section>
  )
}

export default TaskComments
