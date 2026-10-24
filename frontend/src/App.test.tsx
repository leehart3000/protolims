import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from './App'
import { TestProviders } from './test/TestProviders'

function renderApp(route = '/') {
  render(
    <TestProviders route={route}>
      <App />
    </TestProviders>,
  )
}

describe('App', () => {
  it('shows the ProtoLIMS name as a link to the home page', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'ProtoLIMS' })).toHaveAttribute('href', '/')
  })

  it('links to the source code and shows the version', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'free software' })).toHaveAttribute(
      'href',
      'https://github.com/leehart3000/protolims',
    )
    expect(screen.getByText(/^Version .+\/[0-9a-f]{7}$/)).toBeInTheDocument()
  })

  it('goes to the projects page from the main navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json([]))),
    )
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: 'Projects' }))

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('goes to the studies page from the main navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json([]))),
    )
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: 'Studies' }))

    expect(screen.getByRole('heading', { name: 'Studies' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown addresses', () => {
    renderApp('/no-such-page')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
