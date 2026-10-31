import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { deleteProject, deleteStudy } from '../deleting'
import { siteAdmin, signedInWith } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import { DeleteSection } from './DeleteSection'

type Me = components['schemas']['Me']

const STUDY_URL = '/api/v1/projects/P1/studies/S2'

// Answers the delete request with `status` (and, for 409, the API's reason). Returns the
// requests made, as "METHOD path".
function stubDelete(status: number) {
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
      if (status === 409) {
        return Promise.resolve(
          Response.json(
            { detail: "Study 'S2' still has 1 subject, so it can't be deleted" },
            { status },
          ),
        )
      }
      return Promise.resolve(new Response(null, { status }))
    }),
  )
  return requests
}

function renderStudySection(me: Me = siteAdmin) {
  render(
    <TestProviders route="/projects/P1/studies/S2" me={me}>
      <Routes>
        <Route
          path="/projects/P1/studies/S2"
          element={
            <DeleteSection
              noun="study"
              name="S2"
              need={{ role: 'admin', project: 'P1' }}
              explanation="Only an empty study can be deleted."
              onDelete={() => deleteStudy('P1', 'S2')}
              deletedTo="/projects/P1"
            />
          }
        />
        <Route path="/projects/P1" element={<p>Project P1</p>} />
      </Routes>
    </TestProviders>,
  )
}

describe('DeleteSection', () => {
  it('deletes the study once that is confirmed, then goes to its project', async () => {
    const requests = stubDelete(204)
    const user = userEvent.setup()
    renderStudySection()

    expect(screen.getByRole('heading', { name: 'Delete this study' })).toBeInTheDocument()
    expect(screen.getByText('Only an empty study can be deleted.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete study' }))
    expect(screen.getByText('Delete study “S2”? This can’t be undone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/This can’t be undone/)).not.toBeInTheDocument()
    expect(requests).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Delete study' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByText('Project P1')).toBeInTheDocument()
    expect(requests).toEqual([`DELETE ${STUDY_URL}`])
  })

  it("says why, when it isn't empty", async () => {
    stubDelete(409)
    const user = userEvent.setup()
    renderStudySection()

    await user.click(screen.getByRole('button', { name: 'Delete study' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Study 'S2' still has 1 subject, so it can't be deleted.",
    )
    expect(screen.queryByText('Project P1')).not.toBeInTheDocument()
  })

  it('says why, when it was refused for another reason', async () => {
    stubDelete(403)
    const user = userEvent.setup()
    renderStudySection()

    await user.click(screen.getByRole('button', { name: 'Delete study' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("you don't have permission")
  })

  it("is shown only to the project's admins", () => {
    renderStudySection(signedInWith([{ project: 'P1', study: 'S2', role: 'admin' }]))
    expect(screen.queryByRole('heading', { name: 'Delete this study' })).not.toBeInTheDocument()
  })

  it("is shown to a project admin who isn't a site administrator", () => {
    renderStudySection(signedInWith([{ project: 'P1', study: null, role: 'admin' }]))
    expect(screen.getByRole('button', { name: 'Delete study' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('is greyed out while the site is read-only', () => {
    renderStudySection({ ...siteAdmin, read_only: true })
    expect(screen.getByRole('button', { name: 'Delete study' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent(/read-only/)
  })

  it('deletes a project, then goes to the list of projects', async () => {
    const requests = stubDelete(204)
    const user = userEvent.setup()
    render(
      <TestProviders route="/projects/P9">
        <Routes>
          <Route
            path="/projects/P9"
            element={
              <DeleteSection
                noun="project"
                name="P9"
                need={{ siteAdmin: true }}
                explanation="Only a project with no studies can be deleted."
                onDelete={() => deleteProject('P9')}
                deletedTo="/projects"
              />
            }
          />
          <Route path="/projects" element={<p>All projects</p>} />
        </Routes>
      </TestProviders>,
    )

    await user.click(screen.getByRole('button', { name: 'Delete project' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByText('All projects')).toBeInTheDocument()
    expect(requests).toEqual(['DELETE /api/v1/projects/P9'])
  })
})
