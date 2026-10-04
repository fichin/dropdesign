import { useMemo, useRef, useState } from 'react'
import type { User } from '../api/client'
import { findColumnId, getTeamMembers } from '../state/boardReducer'
import { useBoardFilters } from '../state/useBoardFilters'
import { useBoardSync } from '../state/useBoardSync'
import { exportBoard } from '../utils/exportBoard'
import Board from './Board'
import FilterBar from './FilterBar'
import ProjectHeader from './ProjectHeader'
import { BoardPlaceholder, Notice, StatusBanner } from './SyncStatus'
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
        <ProjectHeader title={board.title} onExport={() => exportBoard(board)} />
        <FilterBar filters={filters} people={board.people} searchRef={searchRef} />
        <Board
          board={board}
          readOnly={readOnly}
          onAddTask={(columnId, title) => {
            sync.addTask(columnId, title)
            // A new task might not match the search/filters and would vanish as soon as it's
            // added, so show everything again
            filters.clear()
          }}
          onMoveTask={sync.moveTask}
          onOpenTask={setOpenTaskId}
          isVisible={filters.matches}
          filtering={filters.isFiltering}
          search={filters.search}
        />
      </main>

      {openTask && openColumnId ? (
        <TaskModal
          key={openTask.id}
          task={openTask}
          column={board.columns[openColumnId]}
          people={board.people}
          readOnly={readOnly}
          onUpdate={(changes) => sync.updateTask(openTask.id, changes)}
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
