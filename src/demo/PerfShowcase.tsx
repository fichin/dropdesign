import { useCallback, useEffect, useRef, useState } from 'react'
import type { Board as BoardType } from '../../shared/kanban.ts'
import Board from '../components/Board'
import FilterBar from '../components/FilterBar'
import ProjectHeader, { BOARD_VIEW_ID } from '../components/ProjectHeader'
import TaskList, { LIST_VIRTUALIZATION_THRESHOLD } from '../components/TaskList'
import ThemeToggle from '../components/ThemeToggle'
import { VIRTUALIZE_COLUMN_FROM } from '../components/VirtualCards'
import { boardReducer, type BoardAction } from '../state/boardReducer'
import { viewTabId, type BoardView } from '../state/boardView'
import { useBoardFilters } from '../state/useBoardFilters'
import { exportBoard } from '../utils/exportBoard'
import { isCapped, LOAD_SIZES, UNVIRTUALIZED_VIEW_LIMITS } from './demoSizes'
import { DEMO_ID_PREFIX, generateDemoBoard } from './generateDemoBoard'
import { afterNextPaint, countElements, usePickupTiming, type PickupTiming } from './measure'
import '../components/TopBar.css'
import './PerfShowcase.css'

const VIEW_NAMES: Record<BoardView, string> = { grid: 'Grid', list: 'List', column: 'Column', row: 'Row' }
const MAX_HISTORY = 8

const number = (n: number) => n.toLocaleString('en')
const duration = (ms: number) => `${number(Math.round(ms))} ms`

/** Whether a view renders only what's near the screen at this board size (the app's own rules) */
function isVirtualized(view: BoardView, board: BoardType) {
  if (view === 'list') return Object.keys(board.tasks).length > LIST_VIRTUALIZATION_THRESHOLD
  if (view === 'column') return Object.values(board.columns).some((c) => c.taskIds.length > VIRTUALIZE_COLUMN_FROM)
  return false
}

/** Times taken while the tab was hidden aren't real: the browser stops painting it */
const hiddenNote = (wasHidden: boolean) => (wasHidden ? ' (the tab was in the background, so this time is not reliable)' : '')

interface Results {
  tasks: number
  generateMs: number
  /** null: the view showed the "not virtualized yet" message instead of the board */
  render: { ms: number | null; view: BoardView }
  viewSwitch?: { ms: number | null; view: BoardView }
  pickup?: PickupTiming
  elements: number
  rendered: number
}

interface PerfShowcaseProps {
  onLeave: () => void
  /** Tasks generated on arrival, so there's a board straight away */
  initialTasks?: number
}

/**
 * The performance demo (/perf): a board of generated tasks that lives only in this component's
 * state, with live measurements of how fast the real board components handle it. It never
 * talks to the API and never reads or writes the real board's offline copy or saved view.
 */
function PerfShowcase({ onLeave, initialTasks = LOAD_SIZES[0] }: PerfShowcaseProps) {
  const [board, setBoard] = useState<BoardType | null>(null)
  // Its own view state, not useBoardView: the real board's saved view stays as it was
  const [view, setView] = useState<BoardView>('column')
  const [results, setResults] = useState<Results | null>(null)
  const [history, setHistory] = useState<string[]>([])
  // The last result in a sentence, for screen readers (and the top of the history)
  const [announcement, setAnnouncement] = useState('')
  const [loading, setLoading] = useState(false)
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const filters = useBoardFilters(board)
  const searchRef = useRef<HTMLInputElement>(null)
  const clearFilters = filters.clear
  const taskCount = board ? Object.keys(board.tasks).length : 0

  useEffect(() => {
    const previous = document.title
    document.title = 'Performance demo · DropDesign'
    return () => {
      document.title = previous
    }
  }, [])

  const report = useCallback((sentence: string) => {
    setAnnouncement(sentence)
    setHistory((current) => [sentence, ...current].slice(0, MAX_HISTORY))
  }, [])

  /** Cards (board views) or rows (List view) actually in the page */
  const countRendered = () =>
    document.getElementById(BOARD_VIEW_ID)?.querySelectorAll('.column-tasks article.card, table.task-list tbody th[scope="row"]')
      .length ?? 0

  function load(count: number) {
    setLoading(true)
    const wasHidden = document.hidden
    const start = performance.now()
    const next = generateDemoBoard(count)
    const generated = performance.now()
    setBoard(next)
    clearFilters()
    const capped = isCapped(view, count)
    void afterNextPaint().then((end) => {
      const measured: Results = {
        tasks: count,
        generateMs: generated - start,
        render: { ms: capped ? null : end - generated, view },
        elements: countElements(),
        rendered: countRendered(),
      }
      setResults(measured)
      setLoading(false)
      report(
        capped
          ? `Generated ${number(count)} tasks in ${duration(measured.generateMs)}. The ${VIEW_NAMES[view]} view isn't virtualized yet, so it doesn't show more than ${number(UNVIRTUALIZED_VIEW_LIMITS[view]!)} tasks.`
          : `Rendered ${number(count)} tasks in the ${VIEW_NAMES[view]} view in ${duration(end - generated)}${hiddenNote(wasHidden || document.hidden)}. ${number(measured.elements)} elements in the page.`,
      )
    })
  }

  // The first board, generated on arrival through the same measured path as the buttons
  const loadedOnce = useRef(false)
  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    load(initialTasks)
  })

  function changeView(next: BoardView) {
    if (next === view) return
    const wasHidden = document.hidden
    const start = performance.now()
    setView(next)
    const capped = isCapped(next, taskCount)
    void afterNextPaint().then((end) => {
      setResults(
        (current) =>
          current && {
            ...current,
            viewSwitch: { ms: capped ? null : end - start, view: next },
            elements: countElements(),
            rendered: countRendered(),
          },
      )
      report(
        capped
          ? `The ${VIEW_NAMES[next]} view isn't virtualized yet, so it doesn't show more than ${number(UNVIRTUALIZED_VIEW_LIMITS[next]!)} tasks.`
          : `Switched to the ${VIEW_NAMES[next]} view in ${duration(end - start)}${hiddenNote(wasHidden || document.hidden)}. ${number(countElements())} elements in the page.`,
      )
    })
  }

  usePickupTiming(
    panel,
    useCallback(
      (pickup: PickupTiming) => {
        setResults((current) => current && { ...current, pickup })
        report(
          `Picked up a card in ${duration(pickup.ms)} (${pickup.input}${pickup.input === 'touch' ? ', including the 250 ms press-and-hold' : ''}).`,
        )
      },
      [report],
    ),
  )

  // The same changes the real board makes, applied to the in-memory copy only
  const dispatch = useCallback((action: BoardAction) => setBoard((current) => current && boardReducer(current, action)), [])
  const nextNewTask = useRef(0)
  const addTask = useCallback(
    (columnId: string, title: string) => {
      dispatch({ type: 'addTask', taskId: `${DEMO_ID_PREFIX}new-${++nextNewTask.current}`, columnId, title })
      clearFilters()
    },
    [dispatch, clearFilters],
  )
  const moveTask = useCallback(
    (taskId: string, toColumnId: string, toIndex: number) => dispatch({ type: 'moveTask', taskId, toColumnId, toIndex }),
    [dispatch],
  )
  // The task modal saves comments to the offline copy, so the demo doesn't open it
  const openTask = useCallback(
    () => report('Task details are turned off in the demo, so nothing is ever saved. They work on the real board.'),
    [report],
  )

  const capped = isCapped(view, taskCount)
  const limit = UNVIRTUALIZED_VIEW_LIMITS[view]

  return (
    <>
      <header className="top-bar perf-top-bar">
        <p className="perf-brand">
          DropDesign <span aria-hidden="true">·</span> Performance demo
        </p>
        <div className="top-bar-actions">
          <ThemeToggle className="icon-button" />
          <button type="button" className="button-secondary" onClick={onLeave}>
            Leave demo
          </button>
        </div>
      </header>
      <main>
        <p className="perf-banner" role="note">
          <strong>Demo mode.</strong> These tasks are generated in your browser and kept only in this tab. Nothing is
          sent to the server or saved, and your real boards are not touched.
        </p>

        <section className="perf-panel" aria-labelledby="perf-heading">
          <h2 id="perf-heading">How fast is the board?</h2>
          <p className="perf-intro">
            Load a big board, switch views and drag a card. Every number below is measured live in your browser (
            <code>performance.now()</code> up to the next paint), so it depends on your device.
          </p>
          {import.meta.env.DEV && (
            <p className="perf-warning">
              This is a development build: React does extra checks here, so times are much slower than in production.
            </p>
          )}

          <div className="perf-load" role="group" aria-labelledby="perf-load-label">
            <span id="perf-load-label" className="perf-label">
              Load
            </span>
            {LOAD_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={size === taskCount ? 'button-primary' : 'button-secondary'}
                aria-pressed={size === taskCount}
                disabled={loading}
                onClick={() => load(size)}
              >
                {number(size)} tasks
              </button>
            ))}
          </div>

          <p className="perf-live" role="status" aria-live="polite">
            {announcement}
          </p>

          {results && (
            <table className="perf-results">
              <caption className="visually-hidden">Latest measurements</caption>
              <tbody>
                <tr>
                  <th scope="row">Tasks on the board</th>
                  <td>{number(results.tasks)}</td>
                </tr>
                <tr>
                  <th scope="row">Generate the data</th>
                  <td>{duration(results.generateMs)}</td>
                </tr>
                <tr>
                  <th scope="row">Render the board</th>
                  <td>
                    {results.render.ms === null
                      ? `Not shown in the ${VIEW_NAMES[results.render.view]} view at this size`
                      : `${duration(results.render.ms)} (${VIEW_NAMES[results.render.view]} view)`}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Last view switch</th>
                  <td>
                    {!results.viewSwitch
                      ? 'Not yet: pick a view in the tabs below'
                      : results.viewSwitch.ms === null
                        ? `Not shown in the ${VIEW_NAMES[results.viewSwitch.view]} view at this size`
                        : `${duration(results.viewSwitch.ms)} (to the ${VIEW_NAMES[results.viewSwitch.view]} view)`}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Last card pick-up</th>
                  <td>
                    {results.pickup
                      ? `${duration(results.pickup.ms)} (${results.pickup.input})`
                      : 'Not yet: drag a card, or focus one and press Space'}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Elements in the page</th>
                  <td>{number(results.elements)}</td>
                </tr>
                <tr>
                  <th scope="row">Cards or rows rendered</th>
                  <td>
                    {number(results.rendered)} of {number(results.tasks)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{VIEW_NAMES[view]} view virtualized</th>
                  <td>
                    {board && isVirtualized(view, board)
                      ? 'Yes: only what is near the screen is rendered'
                      : 'No: every card is rendered'}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {history.length > 1 && (
            <details className="perf-history">
              <summary>Earlier measurements</summary>
              <ol>
                {history.slice(1).map((sentence, i) => (
                  <li key={history.length - i}>{sentence}</li>
                ))}
              </ol>
            </details>
          )}
        </section>

        {board && (
          <>
            <ProjectHeader title={board.title} view={view} onViewChange={changeView} onExport={() => exportBoard(board)} />
            <FilterBar filters={filters} people={board.people} searchRef={searchRef} />
          </>
        )}
        <div ref={setPanel} id={BOARD_VIEW_ID} role="tabpanel" aria-labelledby={viewTabId(view)}>
          {board &&
            (capped ? (
              <div className="board-empty perf-capped">
                <p>
                  <strong>
                    The {VIEW_NAMES[view]} view isn't virtualized yet, so the demo shows it with up to {number(limit!)}{' '}
                    tasks.
                  </strong>{' '}
                  It would render all {number(taskCount)} cards at once. The Column and List views render only the
                  cards near the screen, so they handle {number(taskCount)} easily.
                </p>
                <div className="perf-capped-actions">
                  <button type="button" className="button-primary" onClick={() => changeView('column')}>
                    Switch to the Column view
                  </button>
                  <button type="button" className="button-secondary" onClick={() => load(limit!)}>
                    Load {number(limit!)} tasks
                  </button>
                </div>
              </div>
            ) : view === 'list' ? (
              <div className="board-page">
                <TaskList board={board} isVisible={filters.matches} search={filters.search} onOpenTask={openTask} />
              </div>
            ) : (
              <Board
                board={board}
                layout={view}
                readOnly={false}
                onAddTask={addTask}
                onMoveTask={moveTask}
                onOpenTask={openTask}
                isVisible={filters.matches}
                filtering={filters.isFiltering}
                search={filters.search}
              />
            ))}
        </div>
      </main>
    </>
  )
}

export default PerfShowcase
