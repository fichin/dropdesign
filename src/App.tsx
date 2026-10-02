import { useMemo, useReducer } from 'react'
import Board from './components/Board'
import ProjectHeader from './components/ProjectHeader'
import TopBar from './components/TopBar'
import { initialBoard } from './data/mockData'
import { boardReducer, getTeamMembers } from './state/boardReducer'
import { exportBoard } from './utils/exportBoard'

function App() {
  const [board, dispatch] = useReducer(boardReducer, initialBoard)
  const members = useMemo(() => getTeamMembers(board), [board])

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
