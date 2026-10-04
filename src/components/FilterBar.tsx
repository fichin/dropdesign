import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { PRIORITIES, PRIORITY_LABELS, type Assignee } from '../../shared/kanban.ts'
import type { BoardFilters } from '../state/useBoardFilters'
import { CalendarIcon, SearchIcon } from './icons'
import './FilterBar.css'

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)

interface FilterBarProps {
  filters: BoardFilters
  /** Everyone who can be assigned, for the assignee filter */
  people: Assignee[]
  /** The search input, so the top bar's search button and shortcuts can focus it */
  searchRef: RefObject<HTMLInputElement | null>
}

/** Search box, filters, the visible/total count, and "Clear filters" */
function FilterBar({ filters, people, searchRef }: FilterBarProps) {
  // Ctrl/Cmd+K anywhere, or "/" when not typing, focuses the search box
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The task modal blocks the page behind it; leave its keys alone
      if (document.querySelector('dialog[open]')) return
      const target = event.target as HTMLElement
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      const commandK = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey
      const slash = event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey
      if (commandK || slash) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchRef])

  const { counts } = filters

  return (
    <div className="filter-bar" role="search" aria-label="Search and filter tasks">
      <div className="filter-search">
        <SearchIcon className="filter-search-icon" />
        <input
          ref={searchRef}
          type="search"
          className="filter-search-input"
          placeholder="Search tasks…"
          aria-label="Search tasks by title or description"
          aria-keyshortcuts="Control+K Meta+K /"
          value={filters.query}
          onChange={(event) => filters.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              filters.setQuery('')
              event.currentTarget.blur()
            }
          }}
        />
        {!filters.query && (
          <kbd className="filter-search-hint" aria-hidden="true">
            {IS_MAC ? '⌘' : 'Ctrl'} K
          </kbd>
        )}
      </div>

      <div className="filter-controls">
        <FilterMenu label="Priority" selectedCount={filters.priorities.size}>
          {PRIORITIES.map((priority) => (
            <label key={priority} className="filter-option">
              <input
                type="checkbox"
                checked={filters.priorities.has(priority)}
                onChange={() => filters.togglePriority(priority)}
              />
              <span className="filter-priority" data-priority={priority}>
                {PRIORITY_LABELS[priority]}
              </span>
            </label>
          ))}
        </FilterMenu>

        <FilterMenu label="Assignee" selectedCount={filters.assigneeIds.size}>
          {people.map((person) => (
            <label key={person.id} className="filter-option">
              <input
                type="checkbox"
                checked={filters.assigneeIds.has(person.id)}
                onChange={() => filters.toggleAssignee(person.id)}
              />
              <img src={person.avatarUrl} alt="" />
              <span>{person.name}</span>
            </label>
          ))}
        </FilterMenu>

        <button
          type="button"
          className="filter-toggle"
          aria-pressed={filters.overdueOnly}
          onClick={() => filters.setOverdueOnly(!filters.overdueOnly)}
        >
          <CalendarIcon />
          Overdue only
        </button>

        {filters.activeFilterCount > 0 && (
          <span className="filter-badge" title="Active filters">
            <span className="visually-hidden">Active filters: </span>
            {filters.activeFilterCount}
          </span>
        )}

        {filters.isFiltering && (
          <button type="button" className="filter-clear" onClick={filters.clear}>
            Clear filters
          </button>
        )}

        <p className="filter-count" aria-live="polite">
          {filters.isFiltering ? (
            <>
              <strong>{counts.visible}</strong> of {counts.total} tasks
            </>
          ) : (
            `${counts.total} tasks`
          )}
        </p>
      </div>
    </div>
  )
}

interface FilterMenuProps {
  label: string
  selectedCount: number
  children: ReactNode
}

/** A button that opens a checkbox list; closes on Escape or a click outside */
function FilterMenu({ label, selectedCount, children }: FilterMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const menuId = `filter-menu-${label.toLowerCase()}`
  return (
    <div className="filter-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={selectedCount ? 'filter-menu-button filter-menu-button-active' : 'filter-menu-button'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        {selectedCount > 0 && <span className="filter-menu-count">{selectedCount}</span>}
        <span className="filter-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div id={menuId} className="filter-menu-panel" role="group" aria-label={`Filter by ${label.toLowerCase()}`}>
          {children}
        </div>
      )}
    </div>
  )
}

export default FilterBar
