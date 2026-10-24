import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewStudyPage from './NewStudyPage'

type Project = components['schemas']['ProjectRead']
type Study = components['schemas']['StudyRead']

const project: Project = {
  id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'TCGA-BRCA',
  name: 'TCGA Breast Invasive Carcinoma',
  description: null,
  source_repository: 'GDC',
  licence: null,
  citation: null,
  created_at: '2026-10-22T12:00:00Z',
  updated_at: '2026-10-22T12:00:00Z',
  created_by: null,
}

const created: Study = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: project.id,
  code: 'RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: null,
  design_factors: [],
  created_at: '2026-10-23T12:00:00Z',
  updated_at: '2026-10-23T12:00:00Z',
  created_by: null,
}

// The page loads the project (GET); submitting the form creates the study (POST).
function respondToCreateWith(createResponse: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      request.method === 'GET' ? Promise.resolve(Response.json(project)) : createResponse(),
    ),
  )
}

function respondWith(response: Response) {
  respondToCreateWith(() => Promise.resolve(response))
}

function renderPage() {
  render(
    <TestProviders route="/projects/TCGA-BRCA/studies/new">
      <Routes>
        <Route path="/projects/:code/studies/new" element={<NewStudyPage />} />
        <Route path="/projects/:code" element={<h1>Project page</h1>} />
        <Route path="/projects/:code/studies/:studyCode" element={<h1>Study page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  await user.type(screen.getByLabelText('Code'), 'RNASEQ')
  await user.type(screen.getByLabelText('Title'), 'RNA-seq of primary tumours')
  await user.click(screen.getByRole('button', { name: 'Create study' }))
}

describe('NewStudyPage', () => {
  it('shows which project the study will belong to', async () => {
    respondWith(Response.json(created, { status: 201 }))
    renderPage()

    expect(await screen.findByText('TCGA Breast Invasive Carcinoma')).toBeInTheDocument()
    expect(screen.getByText('Project code:')).toBeInTheDocument()
  })

  it('shows a breadcrumb trail back to the project', () => {
    respondWith(Response.json(created, { status: 201 }))
    renderPage()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'TCGA-BRCA' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA',
    )
  })

  it('creates the study and goes to its page', async () => {
    let sentPath = ''
    let sentBody: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.method === 'GET') {
          return Response.json(project)
        }
        sentPath = new URL(request.url).pathname
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Study page' })).toBeInTheDocument()
    expect(sentPath).toBe('/api/v1/projects/TCGA-BRCA/studies')
    expect(sentBody).toEqual({
      code: 'RNASEQ',
      title: 'RNA-seq of primary tumours',
      description: null,
    })
  })

  it('shows that the study is being created', async () => {
    respondToCreateWith(() => new Promise<Response>(() => undefined))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('highlights the code when it is already in use, and clears it on change', async () => {
    respondWith(Response.json({ detail: 'Study code already exists' }, { status: 409 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A study with the code RNASEQ already exists in this project.',
    )
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('Code'), '-2')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Code')).not.toHaveAttribute('aria-invalid')
  })

  it('says when the project does not exist', async () => {
    respondWith(Response.json({ detail: 'Project not found' }, { status: 404 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is no project with the code TCGA-BRCA.',
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the study.')
  })
})
