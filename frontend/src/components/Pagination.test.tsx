import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from './Pagination'

const noop = { onChange: vi.fn(), onLimitChange: vi.fn() }

describe('Pagination', () => {
  it('shows nothing for an empty list', () => {
    const { container } = render(<Pagination offset={0} limit={50} total={0} {...noop} />)
    expect(container.innerHTML).toBe('')
  })

  it('counts a list that fits on one page, without page buttons', () => {
    const { rerender, container } = render(
      <Pagination offset={0} limit={50} total={20} {...noop} />,
    )
    expect(screen.getByText('Showing all 20')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    rerender(<Pagination offset={0} limit={50} total={1} {...noop} />)
    expect(screen.getByText('Showing 1 of 1')).toBeInTheDocument()

    rerender(<Pagination offset={0} limit={50} total={20} position="bottom" {...noop} />)
    expect(container.innerHTML).toBe('')
  })

  it('counts matches when searching', () => {
    const { rerender } = render(<Pagination offset={0} limit={50} total={3} filtered {...noop} />)
    expect(screen.getByText('3 matches')).toBeInTheDocument()

    rerender(<Pagination offset={0} limit={50} total={1} filtered {...noop} />)
    expect(screen.getByText('1 match')).toBeInTheDocument()

    rerender(<Pagination offset={0} limit={50} total={59} filtered {...noop} />)
    expect(screen.getByText('1–50 of 59 matches')).toBeInTheDocument()
  })

  it('moves to the first, previous, next and last pages', () => {
    const onChange = vi.fn()
    render(
      <Pagination
        offset={50}
        limit={50}
        total={1234}
        onChange={onChange}
        onLimitChange={vi.fn()}
      />,
    )

    expect(screen.getByText('51–100 of 1,234')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'First' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onChange).toHaveBeenLastCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onChange).toHaveBeenLastCalledWith(100)
    fireEvent.click(screen.getByRole('button', { name: 'Last' }))
    expect(onChange).toHaveBeenLastCalledWith(1200)
  })

  it('turns off the buttons that would go nowhere', () => {
    const { rerender } = render(<Pagination offset={0} limit={50} total={222} {...noop} />)
    expect(screen.getByRole('button', { name: 'First' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    rerender(<Pagination offset={200} limit={50} total={222} {...noop} />)
    expect(screen.getByText('201–222 of 222')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Last' })).toBeDisabled()
  })

  it('changes the page size at the top only', () => {
    const onLimitChange = vi.fn()
    const { rerender } = render(
      <Pagination
        offset={0}
        limit={50}
        total={222}
        onChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Per page' }), {
      target: { value: '100' },
    })
    expect(onLimitChange).toHaveBeenCalledWith(100)

    rerender(
      <Pagination
        offset={0}
        limit={50}
        total={222}
        position="bottom"
        onChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pages, end of list' })).toBeInTheDocument()
  })
})
