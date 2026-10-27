import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewDataFilePage from './NewDataFilePage'

type Study = components['schemas']['StudyRead']
type Assay = components['schemas']['AssayRead']
type DataFile = components['schemas']['DataFileRead']

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

const run: Assay = {
  id: '0192a5b0-0000-7000-8000-000000000020',
  study_id: study.id,
  name: 'RNA-seq batch 1',
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

const created: DataFile = {
  id: '0192a5b0-0000-7000-8000-000000000030',
  study_id: study.id,
  assay_id: null,
  name: 'counts.tsv',
  external_id: null,
  level: 'raw',
  format: 'TSV',
  uri: 'https://example.org/counts.tsv',
  size_bytes: null,
  sha256: null,
  summary: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  assay_name: null,
  sample_count: 0,
}

const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'

// GET requests load the study and its assays; a POST records the file.
function stubApi({
  create = () => Response.json(created, { status: 201 }),
  assays = () => Response.json({ items: [run], total: 1 }),
}: {
  create?: (request: Request) => Response | Promise<Response>
  assays?: () => Response
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      if (request.method === 'POST') {
        return Promise.resolve(create(request))
      }
      if (new URL(request.url).pathname === `${studyPath}/assays`) {
        return Promise.resolve(assays())
      }
      return Promise.resolve(Response.json(study))
    }),
  )
}

function renderPage(route = '/projects/TCGA-BRCA/studies/RNASEQ/data-files/new') {
  render(
    <TestProviders route={route}>
      <Routes>
        <Route
          path="/projects/:code/studies/:studyCode/data-files/new"
          element={<NewDataFilePage />}
        />
        <Route path="/data-files/:dataFileId" element={<h1>Data file page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  await user.type(await screen.findByLabelText('Name'), 'counts.tsv')
  await user.type(screen.getByLabelText('Location'), 'https://example.org/counts.tsv')
  await user.type(screen.getByLabelText('Format'), 'TSV')
  await user.click(screen.getByRole('button', { name: 'Record data file' }))
}

describe('NewDataFilePage', () => {
  it('shows which study the file will belong to', async () => {
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

  it('records the file and goes to its page', async () => {
    let sentBody: unknown
    stubApi({
      create: async (request) => {
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Name'), 'counts.tsv')
    await user.type(screen.getByLabelText('Location'), 'https://example.org/counts.tsv')
    await user.selectOptions(screen.getByLabelText('Level'), 'processed')
    await user.type(screen.getByLabelText('Format'), 'TSV')
    await user.selectOptions(screen.getByLabelText(/assay/i), run.id)
    await user.type(screen.getByLabelText(/size in bytes/i), '2500000')
    await user.type(screen.getByLabelText(/sha-256/i), 'A'.repeat(64))
    await user.click(screen.getByRole('button', { name: 'Record data file' }))

    expect(await screen.findByRole('heading', { name: 'Data file page' })).toBeInTheDocument()
    expect(sentBody).toEqual({
      name: 'counts.tsv',
      uri: 'https://example.org/counts.tsv',
      level: 'processed',
      format: 'TSV',
      assay_id: run.id,
      size_bytes: 2500000,
      sha256: 'a'.repeat(64),
      external_id: null,
    })
  })

  it('starts from an assay when given one', async () => {
    stubApi()
    renderPage(`/projects/TCGA-BRCA/studies/RNASEQ/data-files/new?assay=${run.id}`)

    expect(await screen.findByLabelText(/assay/i)).toHaveValue(run.id)
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/assays/${run.id}`,
    )
  })

  it('shows that the file is being recorded', async () => {
    stubApi({ create: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Recording…' })).toBeDisabled()
  })

  it('highlights the location when it is already recorded, and clears it on change', async () => {
    stubApi({ create: () => Response.json({ detail: 'Exists' }, { status: 409 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A file at this location is already recorded in this study.',
    )
    expect(screen.getByLabelText('Location')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('Location'), '2')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("shows the API's reason when the location isn't allowed", async () => {
    stubApi({
      create: () =>
        Response.json(
          {
            detail: [
              { msg: "Value error, The URI can't contain a user name or password", loc: [] },
            ],
          },
          { status: 422 },
        ),
    })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The URI can't contain a user name or password.",
    )
  })

  it('says when the study does not exist', async () => {
    stubApi({ create: () => Response.json({ detail: 'Not found' }, { status: 404 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is no study RNASEQ in project TCGA-BRCA.',
    )
  })

  it('shows an error when the API fails', async () => {
    stubApi({ create: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not record the data file.')
  })

  it("shows an error when the study's assays cannot be loaded", async () => {
    stubApi({ assays: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load the study's assays.")
  })

  it('highlights the external ID when it is already used', async () => {
    stubApi({
      create: () =>
        Response.json(
          { detail: "External ID 'X-1' is already used by another data file" },
          { status: 409 },
        ),
    })
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another data file in this study already has this external ID.',
    )
    expect(screen.getByLabelText(/external id/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Location')).not.toHaveAttribute('aria-invalid')
  })
})
