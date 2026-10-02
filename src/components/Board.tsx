import type { Board as BoardType } from '../types/kanban'
import Column from './Column'

interface BoardProps {
  board: BoardType
  onAddTask: (columnId: string, title: string) => void
}

function Board({ board, onAddTask }: BoardProps) {
  return (
    <main className="board">
      {board.columnOrder.map((columnId) => {
        const column = board.columns[columnId]
        const tasks = column.taskIds.map((taskId) => board.tasks[taskId])
        return <Column key={column.id} column={column} tasks={tasks} onAddTask={onAddTask} />
      })}
    </main>
  )
}

export default Board
