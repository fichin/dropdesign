import type { Board, Task } from '../types/kanban'

// Every change to the board goes through this reducer. Drag-and-drop will add
// a 'moveTask' action here rather than mutating state from the UI.
export type BoardAction = {
  type: 'addTask'
  columnId: string
  title: string
}

export function boardReducer(board: Board, action: BoardAction): Board {
  switch (action.type) {
    case 'addTask': {
      const column = board.columns[action.columnId]
      const title = action.title.trim()
      if (!column || !title) return board

      const task: Task = {
        id: crypto.randomUUID(),
        title,
        priority: 'ok',
        progress: column.status === 'completed' ? 100 : 0,
        assignees: [],
        commentCount: 0,
        completedSubtaskCount: 0,
      }

      // New tasks go on top: the add form opens from the column header
      return {
        ...board,
        tasks: { ...board.tasks, [task.id]: task },
        columns: {
          ...board.columns,
          [column.id]: { ...column, taskIds: [task.id, ...column.taskIds] },
        },
      }
    }
  }
}
