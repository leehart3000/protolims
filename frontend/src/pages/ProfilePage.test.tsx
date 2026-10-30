import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import { nobody, signedInWith, siteAdmin } from '../test/people'
import ProfilePage from './ProfilePage'

type Me = components['schemas']['Me']

function renderPage(me: Me | 'fetch') {
  render(
    <TestProviders route="/profile" me={me}>
      <ProfilePage />
    </TestProviders>,
  )
}

const noActivity = { items: [], total: 0 }

// The list of their changes is tested in ActivityList.test.tsx; here it's empty.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(noActivity))),
  )
})

describe('ProfilePage', () => {
  it('shows who is signed in, with their ORCID iD, and when they joined', async () => {
    renderPage(signedInWith([]))

    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    expect(screen.getByText('Site Admin')).toBeInTheDocument() // The test person's name.
    expect(
      screen.getByRole('link', { name: '0000-0001-5109-3700 (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://orcid.org/0000-0001-5109-3700')
    expect(screen.queryByText('Site admin:')).not.toBeInTheDocument()
    expect(screen.getByText('29 October 2026')).toBeInTheDocument()
    expect(screen.getByText('30 October 2026')).toBeInTheDocument()
    expect(await screen.findByText("You haven't made any changes yet.")).toBeInTheDocument()
  })

  it('says when the name is private on ORCID', () => {
    const me = signedInWith([])
    renderPage({ ...me, user: me.user && { ...me.user, name: null } })

    expect(screen.getByText('Private on ORCID')).toBeInTheDocument()
  })

  it('lists their roles, with what each lets them do', () => {
    renderPage(
      signedInWith([
        { project: 'P1', study: null, role: 'admin' },
        { project: 'P2', study: null, role: 'viewer' },
        { project: 'P2', study: 'S1', role: 'editor' },
        { project: 'P3', study: 'S2', role: 'admin' },
      ]),
    )

    const rows = within(screen.getByRole('table', { name: 'Your roles' })).getAllByRole('row')
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      'Project P1AdminYou can see, add and change its records, manage its viewers and editors, and choose its study admins.',
      'Project P2ViewerYou can see its records.',
      'Study S1 in P2EditorYou can see, add and change its records.',
      'Study S2 in P3AdminYou can see, add and change its records, and manage its viewers and editors.',
    ])
    expect(screen.getByRole('link', { name: 'P1' })).toHaveAttribute('href', '/projects/P1')
    expect(screen.getByRole('link', { name: 'S1' })).toHaveAttribute(
      'href',
      '/projects/P2/studies/S1',
    )
  })

  it.each([
    [true, 'you can see everything here but not change anything'],
    [false, 'there is nothing here for you to see'],
  ])('explains having no roles (public reading %s)', (publicRead, text) => {
    renderPage({ ...signedInWith([]), public_read: publicRead })

    expect(screen.getByText(new RegExp(text))).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('marks a site administrator, who needs no roles', () => {
    renderPage(siteAdmin)

    expect(screen.getByText('Site admin')).toBeInTheDocument()
    expect(screen.getByText(/create projects, and choose project admins/)).toBeInTheDocument()
    expect(screen.getByText(/you don't need roles/)).toBeInTheDocument()
  })

  it('signs out, then offers to sign in again', async () => {
    let signedIn = true
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) => {
        const path = new URL(request.url).pathname
        if (path === '/api/v1/auth/logout') {
          signedIn = false
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        if (path === '/api/v1/auth/me/activity') {
          return Promise.resolve(Response.json(noActivity))
        }
        return Promise.resolve(Response.json(signedIn ? siteAdmin : nobody))
      }),
    )
    const user = userEvent.setup()
    renderPage('fetch')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText("You're not signed in.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with ORCID' })).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?return_to=%2Fprofile',
    )
  })
})
