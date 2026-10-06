import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Highlight from './Highlight'

const marked = (container: HTMLElement) => [...container.querySelectorAll('mark')].map((m) => m.textContent)

describe('Highlight', () => {
  it('marks every match, ignoring case but keeping the original text', () => {
    const { container } = render(<Highlight text="Design the DESIGN system" search="design" />)
    expect(marked(container)).toEqual(['Design', 'DESIGN'])
    expect(container).toHaveTextContent('Design the DESIGN system')
  })

  it('leaves text without a match (or without a search) unmarked', () => {
    const { container, rerender } = render(<Highlight text="Write release notes" search="pricing" />)
    expect(marked(container)).toEqual([])
    rerender(<Highlight text="Write release notes" search="" />)
    expect(container).toHaveTextContent('Write release notes')
    expect(marked(container)).toEqual([])
  })
})
