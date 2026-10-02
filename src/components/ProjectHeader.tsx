import type { ComponentType, SVGProps } from 'react'
import { ColumnViewIcon, ExportIcon, GridViewIcon, ListViewIcon, RowViewIcon } from './icons'
import './ProjectHeader.css'

export const BOARD_VIEW_ID = 'board-view'

interface View {
  id: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  available: boolean
}

// Only the board (Grid View) exists so far; the rest are shown for the design but disabled
const VIEWS: View[] = [
  { id: 'grid', label: 'Grid View', Icon: GridViewIcon, available: true },
  { id: 'list', label: 'List View', Icon: ListViewIcon, available: false },
  { id: 'column', label: 'Column View', Icon: ColumnViewIcon, available: false },
  { id: 'row', label: 'Row View', Icon: RowViewIcon, available: false },
]

interface ProjectHeaderProps {
  title: string
  onExport: () => void
}

function ProjectHeader({ title, onExport }: ProjectHeaderProps) {
  return (
    <header className="project-header">
      <div className="project-icon" aria-hidden="true" />

      <div className="project-heading">
        <h1 className="project-title">{title}</h1>
        <div role="tablist" aria-label="Board views" className="view-tabs">
          {VIEWS.map(({ id, label, Icon, available }) => {
            const isActive = id === 'grid'
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`view-tab-${id}`}
                className="view-tab"
                aria-selected={isActive}
                aria-controls={isActive ? BOARD_VIEW_ID : undefined}
                aria-disabled={!available || undefined}
                tabIndex={isActive ? 0 : -1}
                title={available ? undefined : `${label} is coming soon`}
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
