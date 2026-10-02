import { useReducer } from 'react'
import Board from './components/Board'
import { initialBoard } from './data/mockData'
import { boardReducer } from './state/boardReducer'

function App() {
  const [board, dispatch] = useReducer(boardReducer, initialBoard)

  return (
    <Board
      board={board}
      onAddTask={(columnId, title) => dispatch({ type: 'addTask', columnId, title })}
      onMoveTask={(taskId, toColumnId, toIndex) =>
        dispatch({ type: 'moveTask', taskId, toColumnId, toIndex })
      }
    />
  )
}

export default App
