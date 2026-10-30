import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { signedInWith, siteAdmin } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import { MembersSection } from './MembersSection'

type Me = components['schemas']['Me']
type Member = components['schemas']['MemberRead']

const alice: Member = {
  user: {
    id: '0192a5b0-0000-7000-8000-0000000000b1',
    provider: 'orcid',
    subject: '0000-0001-2345-6789',
    name: 'Alice',
  },
  role: 'editor',
}

const carol: Member = {
  user: {
    id: '0192a5b0-0000-7000-8000-0000000000b2',
    provider: 'orcid',
    subject: '0000-0001-1111-1118',
    name: null,
  },
  role: 'viewer',
}

const projectMembers = '/api/v1/projects/P1/members'
const studyMembers = '/api/v1/projects/P1/studies/S1/members'

// Answers listing members with `members`, and each change with `changeStatus`. After a
// change, who is signed in is fetched again too: still the site administrator. Returns the
// changes made, as "METHOD path body".
function stubApi(members: Member[], changeStatus = 200) {
  const changes: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      if (path === '/api/v1/auth/me') {
        return Response.json(siteAdmin)
      }
      if (request.method === 'GET') {
        return Response.json(members)
      }
      changes.push(`${request.method} ${path} ${await request.text()}`.trim())
      return new Response(changeStatus === 200 ? '{}' : null, { status: changeStatus })
    }),
  )
  return changes
}

function renderSection(studyCode?: string, me?: Me) {
  render(
    <TestProviders me={me}>
      {studyCode === undefined ? (
        <MembersSection projectCode="P1" />
      ) : (
        <MembersSection projectCode="P1" studyCode={studyCode} />
      )}
    </TestProviders>,
  )
}

describe('MembersSection', () => {
  it('lists who has a role, including people who have not signed in yet', async () => {
    stubApi([alice, carol])
    renderSection()

    const aliceRow = await screen.findByRole('row', { name: /Alice/ })
    const orcidLink = within(aliceRow).getByRole('link', {
      name: `${alice.user.subject} (opens in a new tab)`,
    })
    expect(orcidLink).toHaveAttribute('href', 'https://orcid.org/0000-0001-2345-6789')
    expect(orcidLink).toHaveAttribute('target', '_blank')
    const carolRow = screen.getByRole('row', { name: /0000-0001-1111-1118/ })
    expect(within(carolRow).getByText('Not signed in yet')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Role for Alice' })).toHaveValue('editor')
  })

  it('changes and removes roles', async () => {
    const changes = stubApi([alice, carol])
    const user = userEvent.setup()
    renderSection()

    // A new role is only saved when Save is pressed.
    const save = await screen.findByRole('button', { name: 'Save role for Alice' })
    expect(save).toBeDisabled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Role for Alice' }), 'admin')
    expect(changes).toEqual([])
    expect(save).toHaveAccessibleDescription('Unsaved change')
    await user.click(save)
    expect(await screen.findByRole('status')).toHaveTextContent('Alice now has the Admin role.')

    // Removing a role has to be confirmed, and can be cancelled. Buttons are disabled while a
    // change is being saved.
    const remove = screen.getByRole('button', { name: 'Remove 0000-0001-1111-1118' })
    await vi.waitFor(() => {
      expect(remove).toBeEnabled()
    })
    await user.click(remove)
    expect(screen.getByText('Remove 0000-0001-1111-1118’s role?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Remove 0000-0001-1111-1118' }))
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await vi.waitFor(() => {
      expect(changes).toEqual([
        `PUT ${projectMembers}/0000-0001-2345-6789 {"role":"admin"}`,
        `DELETE ${projectMembers}/0000-0001-1111-1118`,
      ])
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      '0000-0001-1111-1118’s role was removed.',
    )
  })

  it('adds someone to a study by their ORCID iD', async () => {
    const changes = stubApi([])
    const user = userEvent.setup()
    renderSection('S1')

    expect(await screen.findByText('No one has a role here yet.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('ORCID iD'), '0000-0002-1825-0097')
    await user.selectOptions(screen.getByLabelText('Role'), 'editor')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    await vi.waitFor(() => {
      expect(changes).toEqual([`PUT ${studyMembers}/0000-0002-1825-0097 {"role":"editor"}`])
    })
    await vi.waitFor(() => {
      expect(screen.getByLabelText('ORCID iD')).toHaveValue('')
    })
  })

  it('says when an ORCID iD is not valid, or the change is refused', async () => {
    stubApi([], 422)
    const user = userEvent.setup()
    renderSection()

    await user.type(await screen.findByLabelText('ORCID iD'), '0000-0002-1825-0098')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "0000-0002-1825-0098 isn't a valid ORCID iD.",
    )
  })

  it('says when a change to a study is refused', async () => {
    const changes = stubApi([alice], 403)
    const user = userEvent.setup()
    renderSection('S1')

    await user.click(await screen.findByRole('button', { name: 'Remove Alice' }))
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("you don't have permission")
    expect(changes).toEqual([`DELETE ${studyMembers}/0000-0001-2345-6789`])
  })

  it('says when the members cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ detail: 'Error' }, { status: 500 }))),
    )
    renderSection()

    expect(await screen.findByText(/Could not load members/)).toBeInTheDocument()
  })

  it("keeps a project admin's row read-only for anyone but a site administrator", async () => {
    stubApi([{ ...alice, role: 'admin' }, carol])
    renderSection(undefined, signedInWith([{ project: 'P1', study: null, role: 'admin' }]))

    const remove = await screen.findByRole('button', { name: 'Remove Alice' })
    expect(remove).toHaveAttribute('aria-disabled', 'true')
    expect(remove).toHaveAccessibleDescription(
      'Only a site administrator can give or take away the project admin role.',
    )
    expect(screen.queryByRole('combobox', { name: 'Role for Alice' })).not.toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Alice/ })).toHaveTextContent('Admin')
    // Other people's roles can still be changed, but not to admin, and nobody can be added as
    // an admin.
    const carolsRole = screen.getByRole('combobox', { name: 'Role for 0000-0001-1111-1118' })
    expect(within(carolsRole).getByRole('option', { name: 'Editor' })).toBeEnabled()
    expect(within(carolsRole).getByRole('option', { name: 'Admin' })).toBeDisabled()
    expect(
      within(screen.getByLabelText('Role')).getByRole('option', { name: 'Admin' }),
    ).toBeDisabled()
    expect(
      screen.getByText(/waiting for them\. Only a site administrator can give or take away/),
    ).toBeInTheDocument()
  })

  it("lets a project admin, but not a study admin, change a study admin's role", async () => {
    stubApi([{ ...alice, role: 'admin' }])
    renderSection('S1', signedInWith([{ project: 'P1', study: null, role: 'admin' }]))
    expect(await screen.findByRole('combobox', { name: 'Role for Alice' })).toBeEnabled()
    cleanup()

    renderSection('S1', signedInWith([{ project: 'P1', study: 'S1', role: 'admin' }]))
    expect(await screen.findByRole('button', { name: 'Remove Alice' })).toHaveAccessibleDescription(
      "Only the project's admins can give or take away the study admin role.",
    )
  })

  it('is hidden from anyone who is not an admin there', () => {
    stubApi([alice])
    renderSection('S1', signedInWith([{ project: 'P1', study: 'S1', role: 'editor' }]))

    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument()
  })
})
