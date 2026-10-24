import { render, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import StudyDetailPage from './StudyDetailPage'

type Project = components['schemas']['ProjectRead']
type Study = components['schemas']['StudyRead']

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

const projectPath = '/api/v1/projects/TCGA-BRCA'
const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'

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
  it('shows the study, its project and its design factors', async () => {
    respondByPath({ [projectPath]: Response.json(tcga), [studyPath]: Response.json(rnaseq) })
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

  it('says when there are no design factors', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studyPath]: Response.json({ ...rnaseq, description: null, design_factors: [] }),
    })
    renderPage()

    expect(await screen.findByText('No design factors recorded.')).toBeInTheDocument()
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
})
