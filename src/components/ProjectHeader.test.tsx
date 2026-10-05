import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { BoardView } from '../state/boardView'
import ProjectHeader, { BOARD_VIEW_ID } from './ProjectHeader'

/** The header with its view state, as BoardScreen holds it */
function Harness({ onChange = vi.fn() }: { onChange?: (view: BoardView) => void }) {
  const [view, setView] = useState<BoardView>('grid')
  return (
    <ProjectHeader
      title="DropDesign"
      view={view}
      onViewChange={(next) => {
        setView(next)
        onChange(next)
      }}
      onExport={vi.fn()}
    />
  )
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('ProjectHeader view tabs', () => {
  it('offers all four views as tabs, with Grid selected', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Board views' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Grid View', 'List View', 'Column View', 'Row View'])
    expect(tab('Grid View')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Grid View')).toHaveAttribute('aria-controls', BOARD_VIEW_ID)
    for (const name of ['List View', 'Column View', 'Row View']) {
      expect(tab(name)).toHaveAttribute('aria-selected', 'false')
      expect(tab(name)).not.toHaveAttribute('aria-disabled')
    }
  })

  it('switches view on click, and only the selected tab is in the tab order', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(tab('List View'))
    expect(onChange).toHaveBeenCalledWith('list')
    expect(tab('List View')).toHaveAttribute('aria-selected', 'true')
    expect(tab('List View')).toHaveAttribute('tabindex', '0')
    expect(tab('Grid View')).toHaveAttribute('tabindex', '-1')
    expect(tab('Grid View')).not.toHaveAttribute('aria-controls')
  })

  it('moves between tabs with the arrow keys, Home and End, selecting as it goes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    tab('Grid View').focus()

    await user.keyboard('{ArrowRight}')
    expect(tab('List View')).toHaveFocus()
    expect(tab('List View')).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    expect(tab('Row View')).toHaveFocus()
    await user.keyboard('{ArrowRight}') // wraps around
    expect(tab('Grid View')).toHaveFocus()
    await user.keyboard('{ArrowLeft}') // and back
    expect(tab('Row View')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tab('Grid View')).toHaveAttribute('aria-selected', 'true')
  })
})
