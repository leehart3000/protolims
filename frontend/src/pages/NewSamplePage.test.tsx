import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewSamplePage from './NewSamplePage'

type Study = components['schemas']['StudyRead']
type Subject = components['schemas']['SubjectRead']
type Sample = components['schemas']['SampleRead']

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

const patient: Subject = {
  id: '0192a5b0-0000-7000-8000-000000000005',
  study_id: study.id,
  name: 'TCGA-A1-A0SB',
  external_id: null,
  subject_type: 'patient',
  species: 'Homo sapiens',
  attributes: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
}

const tumour: Sample = {
  id: '0192a5b0-0000-7000-8000-000000000010',
  study_id: study.id,
  name: 'Tumour-01',
  external_id: null,
  subject_id: patient.id,
  parent_sample_id: null,
  material_type: 'tissue',
  status: 'in_storage',
  collected_at: null,
  characteristics: {},
  factor_values: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  subject_name: 'TCGA-A1-A0SB',
  parent_sample_name: null,
}

const created: Sample = { ...tumour, id: '0192a5b0-0000-7000-8000-000000000012', name: 'Tumour-02' }

const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'

// GET requests load the study and its subjects and samples; a POST creates the sample.
function stubApi({
  create = () => Response.json(created, { status: 201 }),
  samples = () => Response.json({ items: [tumour], total: 1 }),
}: {
  create?: (request: Request) => Response | Promise<Response>
  samples?: () => Response
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const path = new URL(request.url).pathname
      if (request.method === 'POST') {
        return Promise.resolve(create(request))
      }
      if (path === studyPath) {
        return Promise.resolve(Response.json(study))
      }
      if (path === `${studyPath}/subjects`) {
        return Promise.resolve(Response.json([patient]))
      }
      return Promise.resolve(samples())
    }),
  )
}

function renderPage(route = '/projects/TCGA-BRCA/studies/RNASEQ/samples/new') {
  render(
    <TestProviders route={route}>
      <Routes>
        <Route path="/projects/:code/studies/:studyCode/samples/new" element={<NewSamplePage />} />
        <Route path="/samples/:sampleId" element={<h1>Sample page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  await user.type(await screen.findByLabelText('Name'), 'Tumour-02')
  await user.type(screen.getByLabelText('Material'), 'tissue')
  await user.click(screen.getByRole('button', { name: 'Create sample' }))
}

describe('NewSamplePage', () => {
  it('shows which study the sample will belong to', async () => {
    stubApi()
    renderPage()

    expect(await screen.findByText('RNA-seq of primary tumours')).toBeInTheDocument()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
    expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
  })

  it('creates the sample and goes to its page', async () => {
    let sentPath = ''
    let sentBody: unknown
    stubApi({
      create: async (request) => {
        sentPath = new URL(request.url).pathname
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Name'), 'Tumour-02')
    await user.type(screen.getByLabelText('Material'), 'tissue')
    await user.selectOptions(screen.getByLabelText(/subject/i), patient.id)
    fireEvent.change(screen.getByLabelText(/collected/i), { target: { value: '2026-10-01' } })
    await user.click(screen.getByRole('button', { name: 'Create sample' }))

    expect(await screen.findByRole('heading', { name: 'Sample page' })).toBeInTheDocument()
    expect(sentPath).toBe(`${studyPath}/samples`)
    expect(sentBody).toEqual({
      name: 'Tumour-02',
      material_type: 'tissue',
      status: 'registered',
      subject_id: patient.id,
      parent_sample_id: null,
      collected_at: '2026-10-01T12:00:00Z',
      external_id: null,
    })
  })

  it('starts from a parent sample when given one', async () => {
    let sentBody: unknown
    stubApi({
      create: async (request) => {
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      },
    })
    const user = userEvent.setup()
    renderPage(`/projects/TCGA-BRCA/studies/RNASEQ/samples/new?parent=${tumour.id}`)

    expect(await screen.findByLabelText(/derived from/i)).toHaveValue(tumour.id)
    expect(screen.getByLabelText(/subject/i)).toHaveValue(patient.id)
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}`,
    )

    await fillInAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Sample page' })).toBeInTheDocument()
    expect(sentBody).toMatchObject({
      subject_id: patient.id,
      parent_sample_id: tumour.id,
      collected_at: null,
    })
  })

  it('fills in the subject from the chosen parent sample', async () => {
    stubApi()
    const user = userEvent.setup()
    renderPage()

    const parent = await screen.findByLabelText(/derived from/i)
    const subject = screen.getByLabelText(/subject/i)
    expect(subject).toHaveValue('')

    await user.selectOptions(parent, tumour.id)
    expect(subject).toHaveValue(patient.id)

    await user.selectOptions(parent, '')
    expect(parent).toHaveValue('')
    expect(subject).toHaveValue(patient.id)
  })

  it('shows that the sample is being created', async () => {
    stubApi({ create: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('highlights the name when it is already used, and clears it on change', async () => {
    stubApi({ create: () => Response.json({ detail: 'Sample already exists' }, { status: 409 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A sample called Tumour-02 already exists in this study.',
    )
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('Name'), '-2')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })

  it('says when the study does not exist', async () => {
    stubApi({ create: () => Response.json({ detail: 'Study not found' }, { status: 404 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is no study RNASEQ in project TCGA-BRCA.',
    )
  })

  it('says when the details are not valid', async () => {
    stubApi({ create: () => Response.json({ detail: [] }, { status: 422 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')
  })

  it('shows an error when the API fails', async () => {
    stubApi({ create: () => Response.json({ detail: 'Internal error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the sample.')
  })

  it('shows an error when the subjects and samples cannot be loaded', async () => {
    stubApi({ samples: () => Response.json({ detail: 'Internal error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not load the study's subjects and samples.",
    )
  })
})
