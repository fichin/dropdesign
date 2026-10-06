import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ana, makeTask, marko, sara } from '../test/fixtures'
import Card from './Card'

const five = [ana, marko, sara, { ...ana, id: 'u4', name: 'David Chen' }, { ...marko, id: 'u5', name: 'Elena Stojanova' }]

describe('Card', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 12)) // 4 Oct 2026
  })

  it('shows the title, priority and progress', () => {
    render(<Card task={makeTask('a', { title: 'Redesign the pricing page', priority: 'high-priority', progress: 60 })} />)
    expect(screen.getByRole('heading', { name: 'Redesign the pricing page' })).toBeInTheDocument()
    const priority = screen.getByText('High Priority')
    expect(priority).toHaveAttribute('data-priority', 'high-priority') // drives the pill colour
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuenow', '60')
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('says Done at 100%', () => {
    render(<Card task={makeTask('a', { progress: 100 })} />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('marks a past due date as overdue, for sighted and screen reader users', () => {
    render(<Card task={makeTask('a', { dueDate: '2026-10-01', progress: 40 })} />)
    const due = screen.getByText('Oct 1').closest('.card-due')
    expect(due).toHaveClass('card-due-overdue')
    expect(due).toHaveAttribute('title', 'Due Thursday, October 1, 2026 (overdue)')
    expect(due).toHaveTextContent('Due Oct 1, overdue')
  })

  it("doesn't call a finished or upcoming task overdue", () => {
    const { rerender } = render(<Card task={makeTask('a', { dueDate: '2026-10-01', progress: 100 })} />)
    expect(screen.getByText('Oct 1').closest('.card-due')).not.toHaveClass('card-due-overdue')
    rerender(<Card task={makeTask('a', { dueDate: '2026-10-04', progress: 0 })} />) // due today
    expect(screen.getByText('Oct 4').closest('.card-due')).not.toHaveClass('card-due-overdue')
  })

  it('shows the year for due dates in another year', () => {
    render(<Card task={makeTask('a', { dueDate: '2027-01-15' })} />)
    expect(screen.getByText('Jan 15, 2027')).toBeInTheDocument()
  })

  it('shows up to four assignees by name, then a "+N" chip', () => {
    render(<Card task={makeTask('a', { assignees: five })} />)
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual([
      'Ana Petrova',
      'Marko Ilievski',
      'Sara Novak',
      'David Chen',
    ])
    expect(screen.getByLabelText('1 more assignees')).toHaveTextContent('+1')
  })

  it('labels the comment and subtask counts, in compact form', () => {
    render(<Card task={makeTask('a', { commentCount: 3, completedSubtaskCount: 2200 })} />)
    expect(screen.getByTitle('Comments')).toHaveTextContent('Comments: 3')
    expect(screen.getByTitle('Completed subtasks')).toHaveTextContent('Completed subtasks: 2.2K')
  })

  it('highlights search matches in the title', () => {
    render(<Card task={makeTask('a', { title: 'Landing page for the landing team' })} search="landing" />)
    const marks = within(screen.getByRole('heading')).getAllByText(/landing/i, { selector: 'mark' })
    expect(marks.map((mark) => mark.textContent)).toEqual(['Landing', 'landing'])
  })
})
