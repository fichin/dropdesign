import { useEffect, useMemo, useReducer } from 'react'
import Board from './components/Board'
import ProjectHeader from './components/ProjectHeader'
import TopBar from './components/TopBar'
import { initialBoard } from './data/mockData'
import { boardReducer, getTeamMembers } from './state/boardReducer'
import { loadBoard, saveBoard } from './state/storage'
import { exportBoard } from './utils/exportBoard'

function App() {
  // Saved board if there's a usable one, otherwise the sample data
  const [board, dispatch] = useReducer(boardReducer, initialBoard, (fallback) => loadBoard() ?? fallback)
  const members = useMemo(() => getTeamMembers(board), [board])

  // Every dispatch produces a new board object, so this saves after each change.
  // Mid-drag rearranging happens in Board's preview, so only the drop is saved.
  useEffect(() => {
    saveBoard(board)
  }, [board])

  return (
    <>
      <TopBar projectTitle={board.title} members={members} />
      <main>
        <ProjectHeader title={board.title} onExport={() => exportBoard(board)} />
        <Board
          board={board}
          onAddTask={(columnId, title) => dispatch({ type: 'addTask', columnId, title })}
          onMoveTask={(taskId, toColumnId, toIndex) =>
            dispatch({ type: 'moveTask', taskId, toColumnId, toIndex })
          }
        />
      </main>
    </>
  )
}

export default App
