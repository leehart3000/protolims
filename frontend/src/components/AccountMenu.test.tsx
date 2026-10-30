import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import AccountMenu from './AccountMenu'

type Me = components['schemas']['Me']

const nobody: Me = { user: null, site_admin: false, public_read: true, roles: [] }

type User = components['schemas']['SignedInUser']

const joUser: User = {
  id: '0192a5b0-0000-7000-8000-000000000009',
  provider: 'orcid',
  subject: '0009-0009-7608-4486',
  name: 'Jo Bloggs',
  created_at: '2026-10-29T10:47:31Z',
  last_signed_in_at: '2026-10-30T09:15:00Z',
}

const jo: Me = { user: joUser, site_admin: false, public_read: true, roles: [] }

// Answers /auth/me with each of `answers` in turn (the last one from then on), and signing
// out with `signOutStatus`. Returns the requests made, as "METHOD path".
function stubApi(answers: Me[], signOutStatus = 204) {
  const requests: string[] = []
  let call = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const path = new URL(request.url).pathname
      requests.push(`${request.method} ${path}`)
      if (path === '/api/v1/auth/logout') {
        return Promise.resolve(new Response(null, { status: signOutStatus }))
      }
      const answer = answers[Math.min(call, answers.length - 1)]
      call += 1
      return Promise.resolve(Response.json(answer))
    }),
  )
  return requests
}

function renderMenu(route = '/') {
  render(
    <TestProviders route={route} me="fetch">
      <AccountMenu />
    </TestProviders>,
  )
}

describe('AccountMenu', () => {
  it('offers to sign in, coming back to the same page', async () => {
    stubApi([nobody])
    renderMenu('/projects?q=brca')

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?return_to=%2Fprojects%3Fq%3Dbrca',
    )
  })

  it('shows who is signed in, and signs them out', async () => {
    const requests = stubApi([jo, nobody])
    const user = userEvent.setup()
    renderMenu()

    expect(await screen.findByText('Jo Bloggs')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(requests).toContain('POST /api/v1/auth/logout')
  })

  it('links the name to the profile page', async () => {
    stubApi([jo])
    renderMenu()

    expect(await screen.findByRole('link', { name: 'Jo Bloggs' })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it('marks a site administrator with a badge', async () => {
    stubApi([{ ...jo, site_admin: true }])
    renderMenu()

    expect(await screen.findByText('Site admin')).toBeInTheDocument()
  })

  it('shows the ORCID iD when the name is private', async () => {
    stubApi([{ ...jo, user: { ...joUser, name: null } }])
    renderMenu()

    expect(await screen.findByText('0009-0009-7608-4486')).toBeInTheDocument()
  })

  it('says so if signing out fails', async () => {
    stubApi([jo], 500)
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out')
    expect(screen.getByText('Jo Bloggs')).toBeInTheDocument()
  })
})
