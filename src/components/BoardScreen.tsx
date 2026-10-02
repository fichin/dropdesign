import { useMemo, useState } from 'react'
import { findColumnId, getTeamMembers } from '../state/boardReducer'
import { useBoardSync } from '../state/useBoardSync'
import { exportBoard } from '../utils/exportBoard'
import Board from './Board'
import ProjectHeader from './ProjectHeader'
import { BoardPlaceholder, Notice, StatusBanner } from './SyncStatus'
import TaskModal from './TaskModal'
import TopBar from './TopBar'

interface BoardScreenProps {
  userEmail?: string
  onLogout: () => void
  /** The API answered 401: the session is missing or has expired */
  onUnauthorized: () => void
}

function BoardScreen({ userEmail, onLogout, onUnauthorized }: BoardScreenProps) {
  // The server's board; see useBoardSync for loading, saving, rollback and the offline copy
  const sync = useBoardSync({ onUnauthorized })
  const { board, status, readOnly, loadError, notice, dismissNotice, retry } = sync
  const members = useMemo(() => (board ? getTeamMembers(board) : []), [board])
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  if (!board) {
    return <BoardPlaceholder status={status} error={loadError} onRetry={retry} />
  }

  // If the open task disappears (deleted, or removed by a reload), the modal just closes
  const openTask = openTaskId ? board.tasks[openTaskId] : undefined
  const openColumnId = openTask && findColumnId(board, openTask.id)
  const noticeElement = <Notice message={notice} onDismiss={dismissNotice} />

  return (
    <>
      <TopBar projectTitle={board.title} members={members} userEmail={userEmail} onLogout={onLogout} />
      <main>
        <StatusBanner status={status} onRetry={retry} />
        <ProjectHeader title={board.title} onExport={() => exportBoard(board)} />
        <Board
          board={board}
          readOnly={readOnly}
          onAddTask={sync.addTask}
          onMoveTask={sync.moveTask}
          onOpenTask={setOpenTaskId}
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
