import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewSubjectPage from './NewSubjectPage'

type Study = components['schemas']['StudyRead']
type Subject = components['schemas']['SubjectRead']

const study: Study = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: null,
  design_factors: [],
  created_at: '2026-10-23T12:00:00Z',
  updated_at: '2026-10-23T12:00:00Z',
  created_by: null,
}

const created: Subject = {
  id: '0192a5b0-0000-7000-8000-000000000005',
  study_id: study.id,
  name: 'Hs 578T',
  external_id: null,
  subject_type: 'cell_line',
  species: 'Homo sapiens',
  attributes: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
}

// The page loads the study (GET); submitting the form creates the subject (POST).
function respondToCreateWith(createResponse: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      request.method === 'GET' ? Promise.resolve(Response.json(study)) : createResponse(),
    ),
  )
}

function respondWith(response: Response) {
  respondToCreateWith(() => Promise.resolve(response))
}

function renderPage() {
  render(
    <TestProviders route="/projects/TCGA-BRCA/studies/RNASEQ/subjects/new">
      <Routes>
        <Route
          path="/projects/:code/studies/:studyCode/subjects/new"
          element={<NewSubjectPage />}
        />
        <Route path="/subjects/:subjectId" element={<h1>Subject page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  await user.type(screen.getByLabelText('Name'), 'Hs 578T')
  await user.selectOptions(screen.getByLabelText('Type'), 'cell_line')
  await user.type(screen.getByLabelText(/species/i), 'Homo sapiens')
  await user.click(screen.getByRole('button', { name: 'Create subject' }))
}

describe('NewSubjectPage', () => {
  it('shows which study the subject will belong to', async () => {
    respondWith(Response.json(created, { status: 201 }))
    renderPage()

    expect(await screen.findByText('RNA-seq of primary tumours')).toBeInTheDocument()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
  })

  it('creates the subject and goes to its page', async () => {
    let sentPath = ''
    let sentBody: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.method === 'GET') {
          return Response.json(study)
        }
        sentPath = new URL(request.url).pathname
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Subject page' })).toBeInTheDocument()
    expect(sentPath).toBe('/api/v1/projects/TCGA-BRCA/studies/RNASEQ/subjects')
    expect(sentBody).toEqual({
      name: 'Hs 578T',
      subject_type: 'cell_line',
      species: 'Homo sapiens',
      external_id: null,
    })
  })

  it('shows that the subject is being created', async () => {
    respondToCreateWith(() => new Promise<Response>(() => undefined))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('highlights the name when it is already used, and clears it on change', async () => {
    respondWith(Response.json({ detail: 'Subject already exists' }, { status: 409 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A subject called Hs 578T already exists in this study.',
    )
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('Name'), '-2')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })

  it('says when the study does not exist', async () => {
    respondWith(Response.json({ detail: 'Study not found' }, { status: 404 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is no study RNASEQ in project TCGA-BRCA.',
    )
  })

  it('says when the details are not valid', async () => {
    respondWith(Response.json({ detail: [] }, { status: 422 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')
  })

  it('shows an error when the API fails', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the subject.')
  })

  it('highlights the external ID when it is already used', async () => {
    respondWith(
      Response.json(
        { detail: "External ID 'X-1' is already used by another subject" },
        { status: 409 },
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another subject in this study already has this external ID.',
    )
    expect(screen.getByLabelText(/external id/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })
})
