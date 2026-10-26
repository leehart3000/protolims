import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewAssayPage from './NewAssayPage'

type Study = components['schemas']['StudyRead']
type Assay = components['schemas']['AssayRead']

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

const created: Assay = {
  id: '0192a5b0-0000-7000-8000-000000000020',
  study_id: study.id,
  name: 'Run-02',
  external_id: null,
  measurement_type: 'transcription profiling',
  technology_type: 'nucleotide sequencing',
  platform: null,
  performed_at: null,
  parameters: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  sample_count: 0,
}

const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'

// A GET loads the study; a POST creates the assay.
function stubApi(
  create: (request: Request) => Response | Promise<Response> = () =>
    Response.json(created, { status: 201 }),
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      request.method === 'POST'
        ? Promise.resolve(create(request))
        : Promise.resolve(Response.json(study)),
    ),
  )
}

function renderPage() {
  render(
    <TestProviders route="/projects/TCGA-BRCA/studies/RNASEQ/assays/new">
      <Routes>
        <Route path="/projects/:code/studies/:studyCode/assays/new" element={<NewAssayPage />} />
        <Route path="/assays/:assayId" element={<h1>Assay page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  await user.type(screen.getByLabelText('Name'), 'Run-02')
  await user.type(screen.getByLabelText('Measurement type'), 'transcription profiling')
  await user.type(screen.getByLabelText('Technology type'), 'nucleotide sequencing')
  await user.click(screen.getByRole('button', { name: 'Create assay' }))
}

describe('NewAssayPage', () => {
  it('shows which study the assay will belong to', async () => {
    stubApi()
    renderPage()

    expect(await screen.findByText('RNA-seq of primary tumours')).toBeInTheDocument()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
  })

  it('creates the assay and goes to its page', async () => {
    let sentPath = ''
    let sentBody: unknown
    stubApi(async (request) => {
      sentPath = new URL(request.url).pathname
      sentBody = await request.json()
      return Response.json(created, { status: 201 })
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Name'), 'Run-02')
    await user.type(screen.getByLabelText('Measurement type'), 'transcription profiling')
    await user.type(screen.getByLabelText('Technology type'), 'nucleotide sequencing')
    await user.type(screen.getByLabelText(/platform/i), 'Illumina HiSeq 2000')
    fireEvent.change(screen.getByLabelText(/performed/i), { target: { value: '2026-10-01' } })
    await user.click(screen.getByRole('button', { name: 'Create assay' }))

    expect(await screen.findByRole('heading', { name: 'Assay page' })).toBeInTheDocument()
    expect(sentPath).toBe(`${studyPath}/assays`)
    expect(sentBody).toEqual({
      name: 'Run-02',
      measurement_type: 'transcription profiling',
      technology_type: 'nucleotide sequencing',
      platform: 'Illumina HiSeq 2000',
      performed_at: '2026-10-01T12:00:00Z',
      external_id: null,
    })
  })

  it('shows that the assay is being created', async () => {
    stubApi(() => new Promise<Response>(() => undefined))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('highlights the name when it is already used, and clears it on change', async () => {
    stubApi(() => Response.json({ detail: 'Assay already exists' }, { status: 409 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An assay called Run-02 already exists in this study.',
    )
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('Name'), '-2')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })

  it('says when the study does not exist', async () => {
    stubApi(() => Response.json({ detail: 'Study not found' }, { status: 404 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is no study RNASEQ in project TCGA-BRCA.',
    )
  })

  it('says when the details are not valid', async () => {
    stubApi(() => Response.json({ detail: [] }, { status: 422 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')
  })

  it('shows an error when the API fails', async () => {
    stubApi(() => Response.json({ detail: 'Internal error' }, { status: 500 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the assay.')
  })
})
