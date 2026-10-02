import type { Board, Task } from '../types/kanban'

// Every change to the board goes through this reducer
export type BoardAction =
  | {
      type: 'addTask'
      columnId: string
      title: string
    }
  | {
      /** Places a task in a column at a position; covers both reordering and moving between columns */
      type: 'moveTask'
      taskId: string
      toColumnId: string
      /** Position in the destination column once the move is done */
      toIndex: number
    }

/** Id of the column holding a task, or the id itself when it's already a column id */
export function findColumnId(board: Board, id: string): string | undefined {
  if (board.columns[id]) return id
  return board.columnOrder.find((columnId) => board.columns[columnId].taskIds.includes(id))
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

    case 'moveTask': {
      const fromColumnId = findColumnId(board, action.taskId)
      const toColumn = board.columns[action.toColumnId]
      const task = board.tasks[action.taskId]
      if (!fromColumnId || !task || !toColumn) return board

      const fromColumn = board.columns[fromColumnId]
      const fromIndex = fromColumn.taskIds.indexOf(action.taskId)
      const isSameColumn = fromColumn.id === toColumn.id

      const remaining = isSameColumn
        ? fromColumn.taskIds.filter((id) => id !== action.taskId)
        : toColumn.taskIds
      const toIndex = Math.max(0, Math.min(action.toIndex, remaining.length))
      if (isSameColumn && toIndex === fromIndex) return board

      const toTaskIds = [...remaining.slice(0, toIndex), action.taskId, ...remaining.slice(toIndex)]

      return {
        ...board,
        columns: {
          ...board.columns,
          ...(!isSameColumn && {
            [fromColumn.id]: {
              ...fromColumn,
              taskIds: fromColumn.taskIds.filter((id) => id !== action.taskId),
            },
          }),
          [toColumn.id]: { ...toColumn, taskIds: toTaskIds },
        },
      }
    }
  }
}
