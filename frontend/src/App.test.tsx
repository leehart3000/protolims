import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { TestProviders } from './test/TestProviders'

// Answers as the API would with nobody signed in and nothing recorded yet.
function stubEmptyApi(publicRead = true, siteAdmin = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      if (new URL(request.url).pathname === '/api/v1/auth/me') {
        return Promise.resolve(
          Response.json({ user: null, site_admin: siteAdmin, public_read: publicRead, roles: [] }),
        )
      }
      return Promise.resolve(Response.json({ items: [], total: 0 }))
    }),
  )
}

beforeEach(() => {
  stubEmptyApi()
})

function renderApp(route = '/') {
  render(
    <TestProviders route={route} me="fetch">
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
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: 'Projects' }))

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it('goes to the studies page from the main navigation', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: 'Studies' }))

    expect(screen.getByRole('heading', { name: 'Studies' })).toBeInTheDocument()
  })

  it('offers to sign in when nobody is signed in', async () => {
    renderApp('/studies')

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?return_to=%2Fstudies',
    )
  })

  it('asks people to sign in first on a private site', async () => {
    stubEmptyApi(false)
    renderApp('/projects?q=brca')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with ORCID' })).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?return_to=%2Fprojects%3Fq%3Dbrca',
    )
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument()
  })

  it('links to the users page for site administrators', async () => {
    stubEmptyApi(true, true)
    renderApp()

    expect(await screen.findByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users')
  })

  it('shows a not-found page for unknown addresses', () => {
    renderApp('/no-such-page')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
