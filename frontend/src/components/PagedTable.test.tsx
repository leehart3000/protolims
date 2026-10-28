import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PagedTable } from './PagedTable'

describe('PagedTable', () => {
  it('puts the page controls above and below the table', () => {
    const controls = {
      q: '',
      offset: 0,
      limit: 25,
      setOffset: vi.fn(),
      changeLimit: vi.fn(),
    }
    render(
      <PagedTable total={60} controls={controls}>
        <table aria-label="Things" />
      </PagedTable>,
    )

    expect(screen.getByRole('table', { name: 'Things' })).toBeInTheDocument()
    expect(screen.getAllByText('1–25 of 60')).toHaveLength(2)
    const top = screen.getByRole('navigation', { name: 'Pages' })
    const bottom = screen.getByRole('navigation', { name: 'Pages, end of list' })
    expect(within(top).getByRole('combobox', { name: 'Per page' })).toBeInTheDocument()

    fireEvent.click(within(bottom).getByRole('button', { name: 'Next' }))
    expect(controls.setOffset).toHaveBeenCalledWith(25)
  })
})
