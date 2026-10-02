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
        tag: 'General',
        tagColor: '#868e96',
        progress: column.status === 'completed' ? 100 : 0,
        assignees: [],
      }

      return {
        ...board,
        tasks: { ...board.tasks, [task.id]: task },
        columns: {
          ...board.columns,
          [column.id]: { ...column, taskIds: [...column.taskIds, task.id] },
        },
      }
    }
  }
}
