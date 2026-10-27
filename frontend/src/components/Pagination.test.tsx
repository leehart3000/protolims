import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('shows nothing for an empty list', () => {
    const { container } = render(<Pagination offset={0} limit={25} total={0} onChange={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('counts a list that fits on one page, without page buttons', () => {
    const { rerender } = render(<Pagination offset={0} limit={25} total={20} onChange={vi.fn()} />)
    expect(screen.getByText('Showing all 20')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()

    rerender(<Pagination offset={0} limit={25} total={1} onChange={vi.fn()} />)
    expect(screen.getByText('Showing 1')).toBeInTheDocument()
  })

  it('counts matches when searching', () => {
    const { rerender } = render(
      <Pagination offset={0} limit={25} total={3} filtered onChange={vi.fn()} />,
    )
    expect(screen.getByText('3 matches')).toBeInTheDocument()

    rerender(<Pagination offset={0} limit={25} total={1} filtered onChange={vi.fn()} />)
    expect(screen.getByText('1 match')).toBeInTheDocument()

    rerender(<Pagination offset={0} limit={25} total={37} filtered onChange={vi.fn()} />)
    expect(screen.getByText('1–25 of 37 matches')).toBeInTheDocument()
  })

  it('shows where it is in a long list, and moves between pages', () => {
    const onChange = vi.fn()
    render(<Pagination offset={25} limit={25} total={1234} onChange={onChange} />)

    expect(screen.getByText('26–50 of 1,234')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onChange).toHaveBeenLastCalledWith(50)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})
