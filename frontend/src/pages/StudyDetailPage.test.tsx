import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import StudyDetailPage from './StudyDetailPage'

type Project = components['schemas']['ProjectRead']
type Study = components['schemas']['StudyRead']
type Subject = components['schemas']['SubjectRead']
type Sample = components['schemas']['SampleRead']
type Assay = components['schemas']['AssayRead']
type DataFile = components['schemas']['DataFileRead']

const tcga: Project = {
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

const rnaseq: Study = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: tcga.id,
  code: 'RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: 'Gene expression in tumour and matched normal tissue.',
  design_factors: [
    { name: 'sample type', description: 'tumour or normal' },
    { name: 'stage', description: null },
  ],
  created_at: '2026-10-23T12:00:00Z',
  updated_at: '2026-10-23T12:00:00Z',
  created_by: null,
}

const patient: Subject = {
  id: '0192a5b0-0000-7000-8000-000000000005',
  study_id: rnaseq.id,
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
  study_id: rnaseq.id,
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

const rnaseqBatch: Assay = {
  id: '0192a5b0-0000-7000-8000-000000000020',
  study_id: rnaseq.id,
  name: 'RNA-seq batch 1',
  external_id: null,
  measurement_type: 'transcription profiling',
  technology_type: 'nucleotide sequencing',
  platform: 'Illumina HiSeq 2000',
  performed_at: null,
  parameters: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  sample_count: 1,
}

const countsFile: DataFile = {
  id: '0192a5b0-0000-7000-8000-000000000030',
  study_id: rnaseq.id,
  assay_id: rnaseqBatch.id,
  name: 'counts.tsv',
  external_id: null,
  level: 'processed',
  format: 'TSV',
  uri: 'https://example.org/RNASEQ/counts.tsv',
  size_bytes: 2_500_000,
  sha256: null,
  summary: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  assay_name: 'RNA-seq batch 1',
  sample_count: 1,
}

const projectPath = '/api/v1/projects/TCGA-BRCA'
const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'
const subjectsPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/subjects'
const samplesPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/samples'
const assaysPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/assays'
const dataFilesPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/data-files'

const noItems = { items: [], total: 0 }

function respondByPath(responses: Record<string, Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      Promise.resolve(
        responses[new URL(request.url).pathname] ??
          Response.json({ detail: 'Not Found' }, { status: 404 }),
      ),
    ),
  )
}

interface ListPage<T> {
  items: T[]
  total: number
}

// Answers each request with a fresh response, and records each list request's query, for
// tests that sort, search or change page.
function stubStudyApi({
  samples = () => ({ items: [tumour], total: 1 }),
  subjects = () => ({ items: [patient], total: 1 }),
  assays = () => ({ items: [rnaseqBatch], total: 1 }),
  dataFiles = () => noItems,
}: {
  samples?: (query: URLSearchParams) => ListPage<Sample>
  subjects?: (query: URLSearchParams) => ListPage<Subject>
  assays?: (query: URLSearchParams) => ListPage<Assay>
  dataFiles?: (query: URLSearchParams) => ListPage<DataFile>
} = {}) {
  const lists: Record<string, [(query: URLSearchParams) => unknown, URLSearchParams[]]> = {
    [samplesPath]: [samples, []],
    [subjectsPath]: [subjects, []],
    [assaysPath]: [assays, []],
    [dataFilesPath]: [dataFiles, []],
  }
  const bodies: Record<string, unknown> = { [projectPath]: tcga, [studyPath]: rnaseq }
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      const list = lists[url.pathname]
      if (list) {
        const [respond, queries] = list
        queries.push(url.searchParams)
        return Promise.resolve(Response.json(respond(url.searchParams)))
      }
      return Promise.resolve(Response.json(bodies[url.pathname]))
    }),
  )
  const queriesFor = (path: string) => lists[path]?.[1] ?? []
  return {
    sampleQueries: queriesFor(samplesPath),
    subjectQueries: queriesFor(subjectsPath),
    assayQueries: queriesFor(assaysPath),
    dataFileQueries: queriesFor(dataFilesPath),
  }
}

function renderPage(studyCode = 'RNASEQ') {
  render(
    <TestProviders route={`/projects/TCGA-BRCA/studies/${studyCode}`}>
      <Routes>
        <Route path="/projects/:code/studies/:studyCode" element={<StudyDetailPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('StudyDetailPage', () => {
  it('shows the study, its project, design factors, subjects, samples and assays', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json({ items: [patient], total: 1 }),
      [samplesPath]: Response.json({ items: [tumour], total: 1 }),
      [assaysPath]: Response.json({ items: [rnaseqBatch], total: 1 }),
      [dataFilesPath]: Response.json({ items: [countsFile], total: 1 }),
    })
    renderPage()

    expect(screen.getByText('Loading study…')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: /RNA-seq of primary tumours/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Study:')).toBeInTheDocument()
    expect(
      screen.getByText('Gene expression in tumour and matched normal tissue.'),
    ).toBeInTheDocument()
    expect(screen.getByText('23 October 2026')).toBeInTheDocument()
    expect(await screen.findByText('TCGA Breast Invasive Carcinoma')).toBeInTheDocument()
    expect(screen.getByText('sample type')).toBeInTheDocument()
    expect(screen.getByText('stage')).toBeInTheDocument()

    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByRole('link', { name: 'Edit study' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ/edit',
    )
    expect(within(details).getByText('sample type')).toBeInTheDocument()

    expect(await screen.findByRole('link', { name: 'TCGA-A1-A0SB' })).toHaveAttribute(
      'href',
      `/subjects/${patient.id}`,
    )
    expect(screen.getByRole('cell', { name: 'Patient' })).toBeInTheDocument()
    expect(screen.getByText('Patient · Homo sapiens')).toBeInTheDocument()
    const newSubjectLinks = screen.getAllByRole('link', { name: 'New subject' })
    expect(newSubjectLinks).toHaveLength(2)
    for (const link of newSubjectLinks) {
      expect(link).toHaveAttribute('href', '/projects/TCGA-BRCA/studies/RNASEQ/subjects/new')
    }

    expect(await screen.findByRole('link', { name: 'Tumour-01' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}`,
    )
    expect(screen.getByRole('cell', { name: 'In storage' })).toBeInTheDocument()
    expect(screen.getByText('tissue · TCGA-A1-A0SB · In storage')).toBeInTheDocument()
    const newSampleLinks = screen.getAllByRole('link', { name: 'New sample' })
    expect(newSampleLinks).toHaveLength(2)
    for (const link of newSampleLinks) {
      expect(link).toHaveAttribute('href', '/projects/TCGA-BRCA/studies/RNASEQ/samples/new')
    }

    expect(await screen.findByRole('link', { name: 'RNA-seq batch 1' })).toHaveAttribute(
      'href',
      `/assays/${rnaseqBatch.id}`,
    )
    expect(screen.getByRole('cell', { name: 'Illumina HiSeq 2000' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'transcription profiling · nucleotide sequencing · Illumina HiSeq 2000 · 1 sample',
      ),
    ).toBeInTheDocument()

    const newAssayLinks = screen.getAllByRole('link', { name: 'New assay' })
    expect(newAssayLinks).toHaveLength(2)
    for (const link of newAssayLinks) {
      expect(link).toHaveAttribute('href', '/projects/TCGA-BRCA/studies/RNASEQ/assays/new')
    }

    expect(await screen.findByRole('link', { name: 'counts.tsv' })).toHaveAttribute(
      'href',
      `/data-files/${countsFile.id}`,
    )
    expect(screen.getByText('https://example.org/RNASEQ/counts.tsv')).toBeInTheDocument()
    expect(screen.getByText('Processed · TSV · 2.5 MB · 1 sample')).toBeInTheDocument()

    const newDataFileLinks = screen.getAllByRole('link', { name: 'New data file' })
    expect(newDataFileLinks).toHaveLength(2)
    for (const link of newDataFileLinks) {
      expect(link).toHaveAttribute('href', '/projects/TCGA-BRCA/studies/RNASEQ/data-files/new')
    }
  })

  it('shows a breadcrumb trail', () => {
    respondByPath({})
    renderPage()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/projects',
    )
    expect(within(trail).getByRole('link', { name: 'TCGA-BRCA' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA',
    )
    expect(within(trail).getByRole('link', { name: 'Studies' })).toHaveAttribute(
      'href',
      '/studies?project=TCGA-BRCA',
    )
    expect(within(trail).getByText('RNASEQ')).toHaveAttribute('aria-current', 'page')
  })

  it('says when there are no design factors, subjects, samples or assays', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json({ ...rnaseq, description: null, design_factors: [] }),
      [subjectsPath]: Response.json(noItems),
      [samplesPath]: Response.json(noItems),
      [assaysPath]: Response.json(noItems),
      [dataFilesPath]: Response.json(noItems),
    })
    renderPage()

    expect(await screen.findByText('No design factors recorded.')).toBeInTheDocument()
    expect(await screen.findByText('No subjects in this study yet.')).toBeInTheDocument()
    expect(await screen.findByText('No samples in this study yet.')).toBeInTheDocument()
    expect(await screen.findByText('No assays in this study yet.')).toBeInTheDocument()
    expect(await screen.findByText('No data files in this study yet.')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('says when the study does not exist', async () => {
    respondByPath({ [projectPath]: Response.json(tcga) })
    renderPage('NOPE')

    expect(await screen.findByRole('heading', { name: 'Study not found' })).toBeInTheDocument()
  })

  it('shows an error when the study cannot be loaded', async () => {
    respondByPath({ [studyPath]: Response.json({ detail: 'Internal error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load study')
  })

  it('shows an error when the subjects cannot be loaded', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json({ detail: 'Internal error' }, { status: 500 }),
      [samplesPath]: Response.json(noItems),
      [assaysPath]: Response.json(noItems),
      [dataFilesPath]: Response.json(noItems),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load subjects')
  })

  it('shows an error when the samples cannot be loaded', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json(noItems),
      [samplesPath]: Response.json({ detail: 'Internal error' }, { status: 500 }),
      [assaysPath]: Response.json(noItems),
      [dataFilesPath]: Response.json(noItems),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load samples')
  })

  it('shows an error when the assays cannot be loaded', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json(noItems),
      [samplesPath]: Response.json(noItems),
      [assaysPath]: Response.json({ detail: 'Internal error' }, { status: 500 }),
      [dataFilesPath]: Response.json(noItems),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load assays')
  })

  it('shows an error when the data files cannot be loaded', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json(noItems),
      [samplesPath]: Response.json(noItems),
      [assaysPath]: Response.json(noItems),
      [dataFilesPath]: Response.json({ detail: 'Internal error' }, { status: 500 }),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load data files')
  })

  it('sorts samples by a column heading', async () => {
    const { sampleQueries } = stubStudyApi()
    const user = userEvent.setup()
    renderPage()

    const samples = within(await screen.findByRole('table', { name: 'Samples' }))
    const nameHeading = samples.getByRole('columnheader', { name: 'Name' })
    expect(nameHeading).toHaveAttribute('aria-sort', 'ascending')
    expect(sampleQueries.at(-1)?.get('sort')).toBe('name')

    await user.click(samples.getByRole('button', { name: 'Name' }))
    await waitFor(() => {
      expect(sampleQueries.at(-1)?.get('sort')).toBe('-name')
    })
    expect(nameHeading).toHaveAttribute('aria-sort', 'descending')

    await user.click(samples.getByRole('button', { name: 'Material' }))
    await waitFor(() => {
      expect(sampleQueries.at(-1)?.get('sort')).toBe('material_type')
    })
    expect(nameHeading).not.toHaveAttribute('aria-sort')
  })

  it('searches samples once typing pauses', async () => {
    const { sampleQueries } = stubStudyApi({
      samples: (query) =>
        query.get('q') === 'zzz' ? { items: [], total: 0 } : { items: [tumour], total: 1 },
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByRole('searchbox', { name: 'Search samples' }), 'zzz')

    expect(await screen.findByText('No samples match “zzz”.')).toBeInTheDocument()
    expect(sampleQueries.map((query) => query.get('q'))).toEqual([null, 'zzz'])
  })

  it('pages through a long list of samples', async () => {
    const { sampleQueries } = stubStudyApi({
      samples: () => ({ items: [tumour], total: 120 }),
      assays: () => noItems,
    })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('1–50 of 120')).toBeInTheDocument()
    const previous = screen.getByRole('button', { name: 'Previous' })
    const next = screen.getByRole('button', { name: 'Next' })
    expect(previous).toBeDisabled()

    await user.click(next)
    expect(await screen.findByText('51–100 of 120')).toBeInTheDocument()
    expect(sampleQueries.at(-1)?.get('offset')).toBe('50')

    await user.click(next)
    expect(await screen.findByText('101–120 of 120')).toBeInTheDocument()
    expect(next).toBeDisabled()

    await user.click(previous)
    expect(await screen.findByText('51–100 of 120')).toBeInTheDocument()
  })

  it('sorts subjects by a column heading', async () => {
    const { subjectQueries } = stubStudyApi()
    const user = userEvent.setup()
    renderPage()

    const subjects = within(await screen.findByRole('table', { name: 'Subjects' }))
    expect(subjects.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await user.click(subjects.getByRole('button', { name: 'Type' }))
    await waitFor(() => {
      expect(subjectQueries.at(-1)?.get('sort')).toBe('subject_type')
    })

    await user.click(subjects.getByRole('button', { name: 'Species' }))
    await waitFor(() => {
      expect(subjectQueries.at(-1)?.get('sort')).toBe('species')
    })
  })

  it('searches subjects once typing pauses', async () => {
    const { subjectQueries } = stubStudyApi({
      subjects: (query) =>
        query.get('q') === 'zzz' ? { items: [], total: 0 } : { items: [patient], total: 1 },
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByRole('searchbox', { name: 'Search subjects' }), 'zzz')

    expect(await screen.findByText('No subjects match “zzz”.')).toBeInTheDocument()
    expect(subjectQueries.map((query) => query.get('q'))).toEqual([null, 'zzz'])
  })

  it('sorts assays by a column heading, and counts their samples', async () => {
    const { assayQueries } = stubStudyApi({
      assays: () => ({ items: [{ ...rnaseqBatch, sample_count: 3 }], total: 1 }),
    })
    const user = userEvent.setup()
    renderPage()

    const assays = within(await screen.findByRole('table', { name: 'Assays' }))
    expect(assays.getByText(/· 3 samples$/)).toBeInTheDocument()

    await user.click(assays.getByRole('button', { name: 'Platform' }))
    await waitFor(() => {
      expect(assayQueries.at(-1)?.get('sort')).toBe('platform')
    })
  })

  it('searches assays once typing pauses', async () => {
    const { assayQueries } = stubStudyApi({
      assays: (query) =>
        query.get('q') === 'zzz' ? { items: [], total: 0 } : { items: [rnaseqBatch], total: 1 },
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByRole('searchbox', { name: 'Search assays' }), 'zzz')

    expect(await screen.findByText('No assays match “zzz”.')).toBeInTheDocument()
    expect(assayQueries.map((query) => query.get('q'))).toEqual([null, 'zzz'])
  })

  it('searches data files, and shows a file without a size', async () => {
    const { dataFileQueries } = stubStudyApi({
      dataFiles: (query) =>
        query.get('q') === 'zzz'
          ? noItems
          : { items: [{ ...countsFile, size_bytes: null, sample_count: 3 }], total: 1 },
    })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Processed · TSV · 3 samples')).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search data files' }), 'zzz')

    expect(await screen.findByText('No data files match “zzz”.')).toBeInTheDocument()
    expect(dataFileQueries.map((query) => query.get('q'))).toEqual([null, 'zzz'])
  })
})
