import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { signedInWith } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import UsersPage from './UsersPage'

type Me = components['schemas']['Me']
type UserSummary = components['schemas']['UserSummary']

const lee: UserSummary = {
  id: '0192a5b0-0000-7000-8000-0000000000c1',
  provider: 'orcid',
  subject: '0000-0002-6473-0964',
  name: 'Lee Hart',
  created_at: '2026-10-29T10:47:31Z',
  last_signed_in_at: '2026-10-29T16:05:13Z',
  site_admin: true,
  roles: [],
}

const alice: UserSummary = {
  ...lee,
  id: '0192a5b0-0000-7000-8000-0000000000c2',
  subject: '0000-0001-2345-6789',
  name: 'Alice',
  site_admin: false,
  roles: [
    { project: 'P1', study: null, role: 'editor' },
    { project: 'P1', study: 'S1', role: 'admin' },
  ],
}

const carol: UserSummary = {
  ...alice,
  id: '0192a5b0-0000-7000-8000-0000000000c3',
  subject: '0000-0001-1111-1118',
  name: null,
  last_signed_in_at: null,
  roles: [],
}

// Answers each users request with `respond`. Returns the queries asked for.
function stubUsers(respond: (query: URLSearchParams) => Response) {
  const queries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const query = new URL(request.url).searchParams
      queries.push(query)
      return Promise.resolve(respond(query))
    }),
  )
  return queries
}

function renderPage(me?: Me) {
  render(
    <TestProviders route="/users" me={me}>
      <Routes>
        <Route path="/users" element={<UsersPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('UsersPage', () => {
  it('lists everyone, with their roles, for site administrators', async () => {
    stubUsers(() => Response.json({ items: [lee, alice, carol], total: 3 }))
    renderPage()

    const leeRow = await screen.findByRole('row', { name: /Lee Hart/ })
    expect(within(leeRow).getByText('Site administrator')).toBeInTheDocument()
    expect(within(leeRow).getByText('29 October 2026')).toBeInTheDocument()

    const aliceRow = screen.getByRole('row', { name: /Alice/ })
    expect(within(aliceRow).getByRole('link', { name: 'P1' })).toHaveAttribute(
      'href',
      '/projects/P1',
    )
    expect(within(aliceRow).getByRole('link', { name: 'P1 / S1' })).toHaveAttribute(
      'href',
      '/projects/P1/studies/S1',
    )
    expect(aliceRow).toHaveTextContent('P1 / S1: Admin')
    const orcidLink = within(aliceRow).getByRole('link', {
      name: `${alice.subject} (opens in a new tab)`,
    })
    expect(orcidLink).toHaveAttribute('href', 'https://orcid.org/0000-0001-2345-6789')

    const carolRow = screen.getByRole('row', { name: /0000-0001-1111-1118/ })
    expect(within(carolRow).getByText('Not signed in yet')).toBeInTheDocument()
    expect(within(carolRow).getByText('None')).toBeInTheDocument()
    expect(within(carolRow).getByText('Never')).toBeInTheDocument()
  })

  it('sorts and searches', async () => {
    // Searches find nobody; otherwise there's Lee.
    const queries = stubUsers((query) =>
      Response.json(query.has('q') ? { items: [], total: 0 } : { items: [lee], total: 1 }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Last signed in' }))
    await vi.waitFor(() => {
      expect(queries.at(-1)?.get('sort')).toBe('last_signed_in_at')
    })
    await user.type(screen.getByLabelText('Search users'), 'smith')

    expect(await screen.findByText('No users match “smith”.')).toBeInTheDocument()
    expect(queries.at(-1)?.get('q')).toBe('smith')
    expect(queries.at(-1)?.get('sort')).toBe('last_signed_in_at')
  })

  it('says when there are no users yet', async () => {
    stubUsers(() => Response.json({ items: [], total: 0 }))
    renderPage()

    expect(await screen.findByText('No users yet.')).toBeInTheDocument()
  })

  it('removes people who have no roles', async () => {
    const removed: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) => {
        if (request.method === 'DELETE') {
          removed.push(new URL(request.url).pathname)
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        return Promise.resolve(Response.json({ items: [lee, alice, carol], total: 3 }))
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove 0000-0001-1111-1118' }))

    // Only Carol has no roles: Lee is a site administrator, and Alice has roles.
    expect(screen.queryByRole('button', { name: 'Remove Lee Hart' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Alice' })).not.toBeInTheDocument()
    await vi.waitFor(() => {
      expect(removed).toEqual(['/api/v1/users/0000-0001-1111-1118'])
    })
  })

  it('explains why someone could not be removed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) =>
        Promise.resolve(
          request.method === 'DELETE'
            ? Response.json({ detail: 'Remove their roles first.' }, { status: 409 })
            : Response.json({ items: [carol], total: 1 }),
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove 0000-0001-1111-1118' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Remove their roles first.')
  })

  it('says when removing someone is refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) =>
        Promise.resolve(
          request.method === 'DELETE'
            ? new Response(null, { status: 403 })
            : Response.json({ items: [carol], total: 1 }),
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Remove 0000-0001-1111-1118' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("you don't have permission")
  })

  it('says when the users cannot be loaded', async () => {
    stubUsers(() => Response.json({ detail: 'Error' }, { status: 500 }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users')
  })

  it('is only for site administrators', () => {
    stubUsers(() => Response.json({ items: [], total: 0 }))
    renderPage(signedInWith([]))

    expect(
      screen.getByText('Only site administrators can see the list of users.'),
    ).toBeInTheDocument()
  })
})
