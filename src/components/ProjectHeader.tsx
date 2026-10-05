import { useRef, type ComponentType, type KeyboardEvent, type SVGProps } from 'react'
import { BOARD_VIEWS, viewTabId, type BoardView } from '../state/boardView'
import { ColumnViewIcon, ExportIcon, GridViewIcon, ListViewIcon, RowViewIcon } from './icons'
import './ProjectHeader.css'

/** The panel the view tabs control (rendered by BoardScreen) */
export const BOARD_VIEW_ID = 'board-view'

const VIEW_DETAILS: Record<BoardView, { label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  grid: { label: 'Grid View', Icon: GridViewIcon },
  list: { label: 'List View', Icon: ListViewIcon },
  column: { label: 'Column View', Icon: ColumnViewIcon },
  row: { label: 'Row View', Icon: RowViewIcon },
}

interface ProjectHeaderProps {
  title: string
  view: BoardView
  onViewChange: (view: BoardView) => void
  onExport: () => void
}

function ProjectHeader({ title, view, onViewChange, onExport }: ProjectHeaderProps) {
  const tabRefs = useRef(new Map<BoardView, HTMLButtonElement>())

  // Tabs pattern: arrow keys (wrapping) and Home/End move between tabs and select them;
  // Tab itself moves on to the panel, since only the selected tab is in the tab order
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = BOARD_VIEWS.indexOf(view)
    const last = BOARD_VIEWS.length - 1
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onViewChange(BOARD_VIEWS[next])
    tabRefs.current.get(BOARD_VIEWS[next])?.focus()
  }

  return (
    <header className="project-header">
      <div className="project-icon" aria-hidden="true" />

      <div className="project-heading">
        <h1 className="project-title">{title}</h1>
        <div role="tablist" aria-label="Board views" className="view-tabs" onKeyDown={handleKeyDown}>
          {BOARD_VIEWS.map((id) => {
            const { label, Icon } = VIEW_DETAILS[id]
            const isActive = id === view
            return (
              <button
                key={id}
                ref={(node) => {
                  if (node) tabRefs.current.set(id, node)
                  else tabRefs.current.delete(id)
                }}
                type="button"
                role="tab"
                id={viewTabId(id)}
                className="view-tab"
                aria-selected={isActive}
                aria-controls={isActive ? BOARD_VIEW_ID : undefined}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onViewChange(id)}
              >
                <Icon />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <button type="button" className="export-button" onClick={onExport}>
        Export Data
        <ExportIcon />
      </button>
    </header>
  )
}

export default ProjectHeader
