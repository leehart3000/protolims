import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import AssaysPage from './AssaysPage'
import DataFilesPage from './DataFilesPage'
import SamplesPage from './SamplesPage'
import SubjectsPage from './SubjectsPage'

type Subject = components['schemas']['SubjectRead']
type Sample = components['schemas']['SampleRead']
type Assay = components['schemas']['AssayRead']
type DataFile = components['schemas']['DataFileRead']

const inStudy = {
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
}

const patient: Subject = {
  ...inStudy,
  id: '0192a5b0-0000-7000-8000-000000000005',
  name: 'TCGA-A1-A0SB',
  external_id: null,
  subject_type: 'patient',
  species: 'Homo sapiens',
  attributes: {},
}

const tumour: Sample = {
  ...inStudy,
  id: '0192a5b0-0000-7000-8000-000000000010',
  name: 'Tumour-01',
  external_id: null,
  subject_id: patient.id,
  parent_sample_id: null,
  material_type: 'tissue',
  status: 'in_storage',
  collected_at: null,
  characteristics: {},
  factor_values: {},
  subject_name: patient.name,
  parent_sample_name: null,
}

const rnaseq: Assay = {
  ...inStudy,
  id: '0192a5b0-0000-7000-8000-000000000020',
  name: 'RNA-seq batch 1',
  external_id: null,
  measurement_type: 'transcription profiling',
  technology_type: 'nucleotide sequencing',
  platform: null,
  performed_at: null,
  parameters: {},
  sample_count: 1,
}

const counts: DataFile = {
  ...inStudy,
  id: '0192a5b0-0000-7000-8000-000000000030',
  assay_id: rnaseq.id,
  name: 'counts.tsv',
  external_id: null,
  level: 'processed',
  format: 'TSV',
  uri: 's3://protolims-data/RNASEQ/counts.tsv',
  size_bytes: null,
  sha256: null,
  summary: {},
  assay_name: rnaseq.name,
  sample_count: 1,
}

// Answers the list at `path` with a page holding `item` (or none, when searching for
// "nothing"), and returns each request's query.
function stubList(path: string, item: object) {
  const queries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname !== path) {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      queries.push(url.searchParams)
      const items = url.searchParams.get('q') === 'nothing' ? [] : [item]
      return Promise.resolve(Response.json({ items, total: items.length }))
    }),
  )
  return queries
}

function renderPage(page: ReactNode) {
  render(<TestProviders>{page}</TestProviders>)
}

describe.each([
  { title: 'Subjects', path: '/api/v1/subjects', page: <SubjectsPage />, item: patient },
  { title: 'Samples', path: '/api/v1/samples', page: <SamplesPage />, item: tumour },
  { title: 'Assays', path: '/api/v1/assays', page: <AssaysPage />, item: rnaseq },
  { title: 'Data files', path: '/api/v1/data-files', page: <DataFilesPage />, item: counts },
])('the $title page', ({ title, path, page, item }) => {
  it('lists every record someone can see, with its study and project', async () => {
    stubList(path, item)
    renderPage(page)

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: title })
    expect(within(table).getByRole('columnheader', { name: 'Study' })).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: item.name })).toBeInTheDocument()
    expect(within(table).getByText('RNASEQ · TCGA-BRCA')).toBeInTheDocument()
  })

  it('searches, and says when nothing matches', async () => {
    const user = userEvent.setup()
    const queries = stubList(path, item)
    renderPage(page)

    await user.type(await screen.findByRole('searchbox'), 'nothing')

    const kind = title.toLowerCase()
    expect(await screen.findByText(`No ${kind} match “nothing”.`)).toBeInTheDocument()
    await waitFor(() => {
      expect(queries.at(-1)?.get('q')).toBe('nothing')
    })
    expect(queries.at(-1)?.get('sort')).toBe('name')
  })

  it('says when there is nothing yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ items: [], total: 0 }))),
    )
    renderPage(page)

    expect(await screen.findByText(`No ${title.toLowerCase()} yet.`)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('says when the list could not be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    )
    renderPage(page)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `Could not load ${title.toLowerCase()}. Please try again later.`,
    )
  })
})
