import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ScrollToTop } from './ScrollToTop'

function Back() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1)
      }}
    >
      Back
    </button>
  )
}

describe('ScrollToTop', () => {
  it('scrolls to the top on a new page, but not when going back', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/one']}>
        <ScrollToTop />
        <Routes>
          <Route path="/one" element={<Link to="/two">Two</Link>} />
          <Route path="/two" element={<Back />} />
        </Routes>
      </MemoryRouter>,
    )
    // The first page is left to the browser.
    expect(scrollTo).not.toHaveBeenCalled()

    await user.click(screen.getByRole('link', { name: 'Two' }))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(scrollTo).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('link', { name: 'Two' })).toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    scrollTo.mockRestore()
  })
})
