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

const projectPath = '/api/v1/projects/TCGA-BRCA'
const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'
const subjectsPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/subjects'
const samplesPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/samples'

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

// Answers each request with a fresh response, and records each samples request's query,
// for tests that sort, search or change page.
function stubStudyApi(samplePage: (query: URLSearchParams) => { items: Sample[]; total: number }) {
  const sampleQueries: URLSearchParams[] = []
  const bodies: Record<string, unknown> = {
    [projectPath]: tcga,
    [studyPath]: rnaseq,
    [subjectsPath]: [patient],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === samplesPath) {
        sampleQueries.push(url.searchParams)
        return Promise.resolve(Response.json(samplePage(url.searchParams)))
      }
      return Promise.resolve(Response.json(bodies[url.pathname]))
    }),
  )
  return sampleQueries
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
  it('shows the study, its project, design factors, subjects and samples', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json([patient]),
      [samplesPath]: Response.json({ items: [tumour], total: 1 }),
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

  it('says when there are no design factors, subjects or samples', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json({ ...rnaseq, description: null, design_factors: [] }),
      [subjectsPath]: Response.json([]),
      [samplesPath]: Response.json({ items: [], total: 0 }),
    })
    renderPage()

    expect(await screen.findByText('No design factors recorded.')).toBeInTheDocument()
    expect(await screen.findByText('No subjects in this study yet.')).toBeInTheDocument()
    expect(await screen.findByText('No samples in this study yet.')).toBeInTheDocument()
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
      [samplesPath]: Response.json({ items: [], total: 0 }),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load subjects')
  })

  it('shows an error when the samples cannot be loaded', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json(rnaseq),
      [subjectsPath]: Response.json([]),
      [samplesPath]: Response.json({ detail: 'Internal error' }, { status: 500 }),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load samples')
  })

  it('sorts samples by a column heading', async () => {
    const sampleQueries = stubStudyApi(() => ({ items: [tumour], total: 1 }))
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('link', { name: 'Tumour-01' })
    const nameHeading = screen.getByRole('button', { name: 'Name' }).closest('th')
    expect(nameHeading).toHaveAttribute('aria-sort', 'ascending')
    expect(sampleQueries.at(-1)?.get('sort')).toBe('name')

    await user.click(screen.getByRole('button', { name: 'Name' }))
    await waitFor(() => {
      expect(sampleQueries.at(-1)?.get('sort')).toBe('-name')
    })
    expect(nameHeading).toHaveAttribute('aria-sort', 'descending')

    await user.click(screen.getByRole('button', { name: 'Material' }))
    await waitFor(() => {
      expect(sampleQueries.at(-1)?.get('sort')).toBe('material_type')
    })
    expect(nameHeading).not.toHaveAttribute('aria-sort')
  })

  it('searches samples once typing pauses', async () => {
    const sampleQueries = stubStudyApi((query) =>
      query.get('q') === 'zzz' ? { items: [], total: 0 } : { items: [tumour], total: 1 },
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByRole('searchbox', { name: 'Search samples' }), 'zzz')

    expect(await screen.findByText('No samples match “zzz”.')).toBeInTheDocument()
    expect(sampleQueries.map((query) => query.get('q'))).toEqual([null, 'zzz'])
  })

  it('pages through a long list of samples', async () => {
    const sampleQueries = stubStudyApi(() => ({ items: [tumour], total: 120 }))
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
})
