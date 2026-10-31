import { render, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import SubjectDetailPage from './SubjectDetailPage'

type Subject = components['schemas']['SubjectRead']
type Sample = components['schemas']['SampleRead']
type SubjectAssay = components['schemas']['SubjectAssayRead']
type SubjectDataFile = components['schemas']['SubjectDataFileRead']

const subjectId = '0192a5b0-0000-7000-8000-000000000005'

const patient: Subject = {
  id: subjectId,
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  name: 'TCGA-A1-A0SB',
  external_id: '0004d251-3f70-4395-b175-c94c2f5b1b81',
  subject_type: 'patient',
  species: 'Homo sapiens',
  attributes: { sex: 'female', age_at_diagnosis: 52 },
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
}

const tumour: Sample = {
  id: '0192a5b0-0000-7000-8000-000000000010',
  study_id: patient.study_id,
  name: 'Tumour-01',
  external_id: null,
  subject_id: subjectId,
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

const plex: SubjectAssay = {
  assay_id: '0192a5b0-0000-7000-8000-000000000020',
  assay_name: 'Plex 1',
  measurement_type: 'protein expression profiling',
  technology_type: 'mass spectrometry',
  platform: null,
  label: 'TMT 126',
  assay_wide_files: 75,
  sample_id: '0192a5b0-0000-7000-8000-000000000012',
  sample_name: 'Tumour-01-protein',
}

const counts: SubjectDataFile = {
  data_file_id: '0192a5b0-0000-7000-8000-000000000030',
  name: 'counts.tsv',
  level: 'processed',
  format: 'TSV',
  uri: 'https://example.org/counts.tsv',
  label: null,
  sample_id: '0192a5b0-0000-7000-8000-000000000011',
  sample_name: 'Tumour-01-RNA',
}

const samplesPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/samples'

// Answers the subject request with `subjectResponse`, the samples request with a page of
// samples, and the requests for its samples' assays and data files with fresh responses.
// Returns the query of each samples request.
function respondWith(
  subjectResponse: Response,
  samplePage: { items: Sample[]; total: number } = { items: [], total: 0 },
  {
    assays = () => Response.json([]),
    dataFiles = () => Response.json([]),
  }: { assays?: () => Response; dataFiles?: () => Response } = {},
) {
  const sampleQueries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === samplesPath) {
        sampleQueries.push(url.searchParams)
        return Promise.resolve(Response.json(samplePage))
      }
      if (url.pathname.endsWith('/assays')) {
        return Promise.resolve(assays())
      }
      if (url.pathname.endsWith('/data-files')) {
        return Promise.resolve(dataFiles())
      }
      return Promise.resolve(subjectResponse)
    }),
  )
  return sampleQueries
}

function renderPage(id = subjectId) {
  render(
    <TestProviders route={`/subjects/${id}`}>
      <Routes>
        <Route path="/subjects/:subjectId" element={<SubjectDetailPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('SubjectDetailPage', () => {
  it('shows the subject, where it belongs, its attributes and its samples', async () => {
    const sampleQueries = respondWith(Response.json(patient), { items: [tumour], total: 1 })
    renderPage()

    expect(screen.getByText('Loading subject…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /TCGA-A1-A0SB/ })).toBeInTheDocument()
    expect(screen.getByText('Subject:')).toBeInTheDocument()
    expect(screen.getByText('Patient')).toBeInTheDocument()
    expect(screen.getByText('Homo sapiens')).toBeInTheDocument()
    expect(screen.getByText('0004d251-3f70-4395-b175-c94c2f5b1b81')).toBeInTheDocument()
    expect(screen.getByText('24 October 2026')).toBeInTheDocument()
    expect(screen.getByText('female')).toBeInTheDocument()
    expect(screen.getByText('52')).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
    expect(within(trail).getByRole('link', { name: 'Studies' })).toHaveAttribute(
      'href',
      '/studies?project=TCGA-BRCA',
    )
    expect(within(trail).getByText('TCGA-A1-A0SB')).toHaveAttribute('aria-current', 'page')

    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByRole('link', { name: 'Edit subject' })).toHaveAttribute(
      'href',
      `/subjects/${subjectId}/edit`,
    )

    expect(await screen.findByRole('link', { name: 'Tumour-01' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}`,
    )
    expect(sampleQueries[0]?.get('subject')).toBe(subjectId)
  })

  it('leaves out missing details and says when there are no attributes or samples', async () => {
    respondWith(Response.json({ ...patient, species: null, external_id: null, attributes: {} }))
    renderPage()

    expect(await screen.findByText('No attributes recorded.')).toBeInTheDocument()
    expect(screen.queryByText('Species:')).not.toBeInTheDocument()
    expect(screen.queryByText('External ID:')).not.toBeInTheDocument()
    expect(await screen.findByText('No samples from this subject yet.')).toBeInTheDocument()
    expect(
      await screen.findByText("None of this subject's samples have been measured in an assay yet."),
    ).toBeInTheDocument()
    expect(
      await screen.findByText("None of this subject's samples are in data files yet."),
    ).toBeInTheDocument()
  })

  it('lists the assays and data files its samples are in, with which sample', async () => {
    respondWith(Response.json(patient), undefined, {
      assays: () => Response.json([plex]),
      dataFiles: () => Response.json([counts]),
    })
    renderPage()

    const assays = within(await screen.findByRole('table', { name: 'Assays' }))
    expect(assays.getByRole('link', { name: 'Plex 1' })).toHaveAttribute(
      'href',
      `/assays/${plex.assay_id}`,
    )
    expect(assays.getByRole('cell', { name: 'Tumour-01-protein' })).toBeInTheDocument()
    expect(assays.getByRole('cell', { name: 'TMT 126' })).toBeInTheDocument()
    expect(
      assays.getByText('Tumour-01-protein · TMT 126 · protein expression profiling'),
    ).toBeInTheDocument()

    const files = within(await screen.findByRole('table', { name: 'Data files' }))
    expect(files.getByRole('link', { name: 'counts.tsv' })).toHaveAttribute(
      'href',
      `/data-files/${counts.data_file_id}`,
    )
    expect(files.getByRole('cell', { name: 'Tumour-01-RNA' })).toBeInTheDocument()
    expect(screen.getByText(/75 files from assay/)).toHaveTextContent(
      "Also in 75 files from assay Plex 1, which hold the data of all the assay's samples.",
    )
  })

  it("lists only its assays' files when its samples have none of their own", async () => {
    // Two of its samples were in the plex, but its files are mentioned once.
    const alsoInPlex = { ...plex, sample_id: tumour.id, sample_name: 'Tumour-01', label: null }
    respondWith(Response.json(patient), undefined, {
      assays: () => Response.json([plex, alsoInPlex]),
    })
    renderPage()

    expect(await screen.findByText(/75 files from assay/)).toHaveTextContent(/^In 75 files/)
    expect(screen.getAllByText(/files from assay/)).toHaveLength(1)
    expect(within(screen.getByRole('table', { name: 'Assays' })).getAllByRole('row')).toHaveLength(
      3,
    )
    expect(screen.queryByRole('table', { name: 'Data files' })).not.toBeInTheDocument()
  })

  it('shows an error when its assays or data files cannot be loaded', async () => {
    const error = () => Response.json({ detail: 'Error' }, { status: 500 })
    respondWith(Response.json(patient), undefined, { assays: error, dataFiles: error })
    renderPage()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Could not load assays. Please try again later.',
      'Could not load data files. Please try again later.',
    ])
  })

  it('says when there is no such subject', async () => {
    respondWith(Response.json({ detail: 'Not Found' }, { status: 404 }))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Subject not found' })).toBeInTheDocument()
  })

  it('treats an invalid ID like an unknown one', async () => {
    respondWith(Response.json({ detail: [] }, { status: 422 }))
    renderPage('not-a-uuid')

    expect(await screen.findByRole('heading', { name: 'Subject not found' })).toBeInTheDocument()
  })

  it('shows an error when the subject cannot be loaded', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load subject')
  })
})
