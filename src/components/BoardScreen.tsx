import { useCallback, useMemo, useRef, useState } from 'react'
import type { User } from '../api/client'
import { findColumnId, getTeamMembers } from '../state/boardReducer'
import { useBoardView, viewTabId } from '../state/boardView'
import { useBoardFilters } from '../state/useBoardFilters'
import { useBoardSync } from '../state/useBoardSync'
import { exportBoard } from '../utils/exportBoard'
import Board from './Board'
import FilterBar from './FilterBar'
import ProjectHeader, { BOARD_VIEW_ID } from './ProjectHeader'
import { BoardPlaceholder, Notice, StatusBanner } from './SyncStatus'
import TaskList from './TaskList'
import TaskModal from './TaskModal'
import TopBar from './TopBar'

interface BoardScreenProps {
  /** The signed-in user; unknown while the session is being checked or the server is unreachable */
  user?: User
  onLogout: () => void
  /** The API answered 401: the session is missing or has expired */
  onUnauthorized: () => void
}

function BoardScreen({ user, onLogout, onUnauthorized }: BoardScreenProps) {
  // The server's board; see useBoardSync for loading, saving, rollback and the offline copy
  const sync = useBoardSync({ onUnauthorized })
  const { board, status, readOnly, loadError, notice, dismissNotice, retry } = sync
  const members = useMemo(() => (board ? getTeamMembers(board) : []), [board])
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  // Search and filters: local view state only, never sent to the server
  const filters = useBoardFilters(board)
  const searchRef = useRef<HTMLInputElement>(null)
  // Grid, List, Column or Row: all show the same board, search and filters
  const [view, setView] = useBoardView()

  // Every callback handed to the (memoized) Board keeps its identity between renders,
  // or opening a task or typing a search would re-render every card
  const { addTask } = sync
  const clearFilters = filters.clear
  const handleAddTask = useCallback(
    (columnId: string, title: string) => {
      addTask(columnId, title)
      // A new task might not match the search/filters and would vanish as soon as it's
      // added, so show everything again
      clearFilters()
    },
    [addTask, clearFilters],
  )

  if (!board) {
    return <BoardPlaceholder status={status} error={loadError} onRetry={retry} />
  }

  // If the open task disappears (deleted, or removed by a reload), the modal just closes
  const openTask = openTaskId ? board.tasks[openTaskId] : undefined
  const openColumnId = openTask && findColumnId(board, openTask.id)
  const noticeElement = <Notice message={notice} onDismiss={dismissNotice} />

  return (
    <>
      <TopBar
        projectTitle={board.title}
        members={members}
        userEmail={user?.email}
        onLogout={onLogout}
        onSearch={() => searchRef.current?.focus()}
      />
      <main>
        <StatusBanner status={status} onRetry={retry} />
        {user?.demo && (
          <p className="status-banner" role="note">
            You're exploring the demo board. Look around and change anything; it resets every day, and
            tasks can't be deleted.
          </p>
        )}
        <ProjectHeader title={board.title} view={view} onViewChange={setView} onExport={() => exportBoard(board)} />
        <FilterBar filters={filters} people={board.people} searchRef={searchRef} />
        {filters.counts.total === 0 ? (
          <div className="board-empty">
            <p>
              <strong>This board has no tasks yet.</strong>{' '}
              {view === 'list'
                ? 'Add the first one from the Grid, Column or Row view.'
                : 'Add the first one with the + button on any column.'}
            </p>
          </div>
        ) : (
          filters.isFiltering &&
          filters.counts.visible === 0 && (
            <div className="board-empty">
              <p>
                <strong>No tasks match your search and filters.</strong>
              </p>
              <button type="button" className="button-secondary" onClick={filters.clear}>
                Clear filters
              </button>
            </div>
          )
        )}
        <div id={BOARD_VIEW_ID} role="tabpanel" aria-labelledby={viewTabId(view)}>
          {view === 'list' ? (
            <div className="board-page">
              <TaskList board={board} isVisible={filters.matches} search={filters.search} onOpenTask={setOpenTaskId} />
            </div>
          ) : (
            <Board
              board={board}
              layout={view}
              readOnly={readOnly}
              onAddTask={handleAddTask}
              onMoveTask={sync.moveTask}
              onOpenTask={setOpenTaskId}
              isVisible={filters.matches}
              filtering={filters.isFiltering}
              search={filters.search}
            />
          )}
        </div>
      </main>

      {openTask && openColumnId ? (
        <TaskModal
          key={openTask.id}
          task={openTask}
          column={board.columns[openColumnId]}
          columns={board.columnOrder.map((columnId) => board.columns[columnId])}
          people={board.people}
          readOnly={readOnly}
          onUpdate={(changes) => sync.updateTask(openTask.id, changes)}
          // To the top of the new column (the same rules as dropping a card there)
          onMove={(columnId) => sync.moveTask(openTask.id, columnId, 0)}
          onDelete={() => sync.deleteTask(openTask.id)}
          onClose={() => setOpenTaskId(null)}
          currentUser={user}
          comments={sync}
        >
          {/* The modal sits in the browser's top layer, so messages must render inside it to be seen */}
          {noticeElement}
        </TaskModal>
      ) : (
        noticeElement
      )}
    </>
  )
}

export default BoardScreen
