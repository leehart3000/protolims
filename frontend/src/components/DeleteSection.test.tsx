import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { nobody, siteAdmin, signedInWith } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import { DeleteSection } from './DeleteSection'

type Me = components['schemas']['Me']

// Answers the delete request with `status` and `body` (and /auth/me with `me`). Returns the
// delete requests made, as "METHOD path".
function stubDelete(status: number, body?: object, me: Me = nobody) {
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const path = new URL(request.url).pathname
      if (path === '/api/v1/auth/me') {
        return Promise.resolve(Response.json(me))
      }
      requests.push(`${request.method} ${path}`)
      return Promise.resolve(
        body ? Response.json(body, { status }) : new Response(null, { status }),
      )
    }),
  )
  return requests
}

// The section on study S2's page (or, with `onProject`, on project P1's), with the pages it
// goes to afterwards.
function renderSection({
  me = siteAdmin,
  onProject = false,
}: { me?: Me | 'fetch'; onProject?: boolean } = {}) {
  render(
    <TestProviders route="/here" me={me}>
      <Routes>
        <Route
          path="/here"
          element={<DeleteSection project="P1" study={onProject ? undefined : 'S2'} />}
        />
        <Route path="/projects/P1" element={<p>Project P1</p>} />
        <Route path="/projects" element={<p>All projects</p>} />
      </Routes>
    </TestProviders>,
  )
}

async function deleteIt(noun: 'study' | 'project') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: `Delete ${noun}` }))
  await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
}

describe('DeleteSection', () => {
  it('deletes the study once that is confirmed, then goes to its project', async () => {
    const requests = stubDelete(204)
    const user = userEvent.setup()
    renderSection()

    expect(screen.getByRole('heading', { name: 'Delete this study' })).toBeInTheDocument()
    expect(screen.getByText(/Only an empty study can be deleted/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete study' }))
    expect(screen.getByText('Delete study “S2”? This can’t be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/This can’t be undone/)).not.toBeInTheDocument()
    expect(requests).toEqual([])

    await deleteIt('study')

    expect(await screen.findByText('Project P1')).toBeInTheDocument()
    expect(requests).toEqual(['DELETE /api/v1/projects/P1/studies/S2'])
  })

  it("says why, when it isn't empty", async () => {
    stubDelete(409, { detail: "Study 'S2' still has 1 subject, so it can't be deleted" })
    renderSection()

    await deleteIt('study')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Study 'S2' still has 1 subject, so it can't be deleted.",
    )
    expect(screen.queryByText('Project P1')).not.toBeInTheDocument()
  })

  it('says why, when it was refused for another reason', async () => {
    stubDelete(403)
    renderSection()

    await deleteIt('study')

    expect(await screen.findByRole('alert')).toHaveTextContent("you don't have permission")
  })

  it("is shown to the project's admins, and only them", () => {
    renderSection({ me: signedInWith([{ project: 'P1', study: null, role: 'admin' }]) })
    expect(screen.getByRole('button', { name: 'Delete study' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it("isn't shown to a study's own admin", () => {
    renderSection({ me: signedInWith([{ project: 'P1', study: 'S2', role: 'admin' }]) })
    expect(screen.queryByRole('heading', { name: 'Delete this study' })).not.toBeInTheDocument()
  })

  it('is greyed out, saying why, while the site is read-only', () => {
    renderSection({ me: { ...siteAdmin, read_only: true } })
    expect(screen.getByRole('button', { name: 'Delete study' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent(/read-only/)
  })

  it('deletes a project, then goes to the list of projects', async () => {
    const requests = stubDelete(204)
    renderSection({ onProject: true })

    expect(screen.getByText(/Only a project with no studies can be deleted/)).toBeInTheDocument()
    await deleteIt('project')

    expect(await screen.findByText('All projects')).toBeInTheDocument()
    expect(requests).toEqual(['DELETE /api/v1/projects/P1'])
  })

  it("says why a project wasn't deleted", async () => {
    stubDelete(409, { detail: "Project 'P1' still has 2 studies, so it can't be deleted" })
    renderSection({ onProject: true })

    await deleteIt('project')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Project 'P1' still has 2 studies, so it can't be deleted.",
    )
  })

  it("falls back to a general message when the API doesn't say why", async () => {
    stubDelete(409, {})
    renderSection({ onProject: true })

    await deleteIt('project')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete it.')
  })

  it('says why a project was refused for another reason', async () => {
    stubDelete(500)
    renderSection({ onProject: true })

    await deleteIt('project')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete it.')
  })

  it("shows nothing while it's still finding out who's signed in", () => {
    stubDelete(204)
    renderSection({ me: 'fetch', onProject: true })

    expect(screen.queryByRole('heading', { name: 'Delete this project' })).not.toBeInTheDocument()
  })
})
