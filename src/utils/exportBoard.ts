import type { Board } from '../../shared/kanban.ts'

/** Downloads the board as a JSON file, e.g. "project-planetx-2026-10-02.json" */
export function exportBoard(board: Board) {
  const exportedAt = new Date()
  const data = { format: 'kanban-board', version: 1, exportedAt: exportedAt.toISOString(), board }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const slug = board.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const date = exportedAt.toISOString().slice(0, 10)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slug || 'board'}-${date}.json`
  link.click()

  // Give the browser a moment to start the download before freeing the file
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
