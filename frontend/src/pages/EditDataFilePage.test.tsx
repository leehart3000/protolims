import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import EditDataFilePage from './EditDataFilePage'

type Assay = components['schemas']['AssayRead']
type DataFile = components['schemas']['DataFileRead']

const run: Assay = {
  id: '0192a5b0-0000-7000-8000-000000000020',
  study_id: '0192a5b0-0000-7000-8000-000000000002',
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

const counts: DataFile = {
  id: '0192a5b0-0000-7000-8000-000000000030',
  study_id: run.study_id,
  assay_id: run.id,
  name: 'counts.tsv',
  external_id: 'GDC-FILE-01',
  level: 'processed',
  format: 'TSV',
  uri: 'https://example.org/counts.tsv',
  size_bytes: 2500000,
  sha256: 'a'.repeat(64),
  summary: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  assay_name: run.name,
  sample_count: 0,
}

// GET requests load the file and the study's assays; a PATCH saves changes.
function stubApi({
  file = () => Response.json(counts),
  assays = () => Response.json({ items: [run], total: 1 }),
  update = () => Response.json(counts),
}: {
  file?: () => Response
  assays?: () => Response
  update?: (request: Request) => Response | Promise<Response>
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      if (request.method === 'PATCH') {
        return Promise.resolve(update(request))
      }
      if (new URL(request.url).pathname.endsWith('/assays')) {
        return Promise.resolve(assays())
      }
      return Promise.resolve(file())
    }),
  )
}

function renderPage() {
  render(
    <TestProviders route={`/data-files/${counts.id}/edit`}>
      <Routes>
        <Route path="/data-files/:dataFileId/edit" element={<EditDataFilePage />} />
        <Route path="/data-files/:dataFileId" element={<h1>Data file page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))
}

describe('EditDataFilePage', () => {
  it("shows the file's current details", async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading data file…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Name')).toHaveValue('counts.tsv')
    expect(screen.getByText('Edit data file:')).toBeInTheDocument()
    expect(screen.getByLabelText('Location')).toHaveValue('https://example.org/counts.tsv')
    expect(screen.getByLabelText('Level')).toHaveValue('processed')
    expect(screen.getByLabelText('Format')).toHaveValue('TSV')
    expect(screen.getByLabelText(/assay/i)).toHaveValue(run.id)
    expect(screen.getByLabelText(/size in bytes/i)).toHaveValue(2500000)
    expect(screen.getByLabelText(/sha-256/i)).toHaveValue('a'.repeat(64))
    expect(screen.getByLabelText(/external id/i)).toHaveValue('GDC-FILE-01')

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/data-files/${counts.id}`,
    )
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'counts.tsv' })).toHaveAttribute(
      'href',
      `/data-files/${counts.id}`,
    )
  })

  it('saves only the changed fields, then goes back to the file', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(counts)
      },
    })
    const user = userEvent.setup()
    renderPage()

    const format = await screen.findByLabelText('Format')
    await user.clear(format)
    await user.type(format, 'CSV')
    await save(user)

    expect(await screen.findByRole('heading', { name: 'Data file page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ format: 'CSV' })
  })

  it('clears emptied fields', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(counts)
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.clear(await screen.findByLabelText(/size in bytes/i))
    await user.clear(screen.getByLabelText(/sha-256/i))
    await user.selectOptions(screen.getByLabelText(/assay/i), '')
    await save(user)

    expect(await screen.findByRole('heading', { name: 'Data file page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ assay_id: null, size_bytes: null, sha256: null })
  })

  it('shows that the changes are being saved', async () => {
    stubApi({ update: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('highlights the location when it is already recorded', async () => {
    stubApi({ update: () => Response.json({ detail: 'Exists' }, { status: 409 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A file at this location is already recorded in this study.',
    )
    expect(screen.getByLabelText('Location')).toHaveAttribute('aria-invalid', 'true')
  })

  it("shows the API's explanation when a change breaks a rule", async () => {
    stubApi({
      update: () =>
        Response.json(
          { detail: 'The assay must be an existing assay in the same study' },
          { status: 422 },
        ),
    })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The assay must be an existing assay in the same study',
    )
  })

  it('shows an error when the changes cannot be saved', async () => {
    stubApi({ update: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes.')
  })

  it('says when there is no such data file', async () => {
    stubApi({ file: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Data file not found' })).toBeInTheDocument()
  })

  it('shows an error when the data file cannot be loaded', async () => {
    stubApi({ file: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load data file')
  })

  it("shows an error when the study's assays cannot be loaded", async () => {
    stubApi({ assays: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load the study's assays.")
  })
})
