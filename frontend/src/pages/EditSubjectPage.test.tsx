import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import EditSubjectPage from './EditSubjectPage'

type Subject = components['schemas']['SubjectRead']

const cellLine: Subject = {
  id: '0192a5b0-0000-7000-8000-000000000005',
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  name: 'Hs 578T',
  external_id: 'CVCL_0332',
  subject_type: 'cell_line',
  species: 'Homo sapiens',
  attributes: { tissue: 'breast' },
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'CPTAC-BRCA',
  study_code: 'PILOT',
}

// GET requests load the subject; a PATCH saves changes.
function stubApi({
  subject = () => Response.json(cellLine),
  update = () => Response.json(cellLine),
}: {
  subject?: () => Response
  update?: (request: Request) => Response | Promise<Response>
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      Promise.resolve(request.method === 'PATCH' ? update(request) : subject()),
    ),
  )
}

function renderPage() {
  render(
    <TestProviders route={`/subjects/${cellLine.id}/edit`}>
      <Routes>
        <Route path="/subjects/:subjectId/edit" element={<EditSubjectPage />} />
        <Route path="/subjects/:subjectId" element={<h1>Subject page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))
}

describe('EditSubjectPage', () => {
  it("shows the subject's current details", async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading subject…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Name')).toHaveValue('Hs 578T')
    expect(screen.getByText('Edit subject:')).toBeInTheDocument()
    expect(screen.getByLabelText('Type')).toHaveValue('cell_line')
    expect(screen.getByLabelText(/species/i)).toHaveValue('Homo sapiens')
    expect(screen.getByLabelText(/external id/i)).toHaveValue('CVCL_0332')

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/subjects/${cellLine.id}`,
    )
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'Hs 578T' })).toHaveAttribute(
      'href',
      `/subjects/${cellLine.id}`,
    )
  })

  it('saves only the changed fields, then goes back to the subject', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(cellLine)
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Type'), 'patient')
    await user.clear(screen.getByLabelText(/species/i))
    await save(user)

    expect(await screen.findByRole('heading', { name: 'Subject page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ subject_type: 'patient', species: null })
  })

  it('shows that the changes are being saved', async () => {
    stubApi({ update: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('highlights the name when it is already used, and clears it on change', async () => {
    stubApi({ update: () => Response.json({ detail: 'Exists' }, { status: 409 }) })
    const user = userEvent.setup()
    renderPage()

    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'MCF7')
    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A subject called MCF7 already exists in this study.',
    )
    expect(name).toHaveAttribute('aria-invalid', 'true')

    await user.type(name, '-x')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says when the details are not valid', async () => {
    stubApi({ update: () => Response.json({ detail: [] }, { status: 422 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')
  })

  it('shows an error when the changes cannot be saved', async () => {
    stubApi({ update: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes.')
  })

  it('says when there is no such subject', async () => {
    stubApi({ subject: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Subject not found' })).toBeInTheDocument()
  })

  it('shows an error when the subject cannot be loaded', async () => {
    stubApi({ subject: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load subject')
  })
})
