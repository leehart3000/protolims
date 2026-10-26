import { render, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import ProjectDetailPage from './ProjectDetailPage'

type Project = components['schemas']['ProjectRead']
type Study = components['schemas']['StudyRead']

const tcga: Project = {
  id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'TCGA-BRCA',
  name: 'TCGA Breast Invasive Carcinoma',
  description: 'Breast cancer cohort from The Cancer Genome Atlas.',
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
  code: 'TCGA-BRCA-RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: null,
  design_factors: [],
  created_at: '2026-10-22T12:00:00Z',
  updated_at: '2026-10-22T12:00:00Z',
  created_by: null,
}

const projectPath = '/api/v1/projects/TCGA-BRCA'
const studiesPath = '/api/v1/projects/TCGA-BRCA/studies'

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

function renderPage(code = 'TCGA-BRCA') {
  render(
    <TestProviders route={`/projects/${code}`}>
      <Routes>
        <Route path="/projects/:code" element={<ProjectDetailPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('ProjectDetailPage', () => {
  it('shows the project and its studies', async () => {
    respondByPath({ [projectPath]: Response.json(tcga), [studiesPath]: Response.json([rnaseq]) })
    renderPage()

    expect(screen.getByText('Loading project…')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: /TCGA Breast Invasive Carcinoma/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Project:')).toBeInTheDocument()
    expect(
      screen.getByText('Breast cancer cohort from The Cancer Genome Atlas.'),
    ).toBeInTheDocument()
    expect(screen.getByText('TCGA-BRCA')).toBeInTheDocument()
    expect(screen.getByText('GDC')).toBeInTheDocument()
    expect(screen.getByText('22 October 2026')).toBeInTheDocument()
    expect(screen.queryByText('Licence:')).not.toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'TCGA-BRCA-RNASEQ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'RNA-seq of primary tumours' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/TCGA-BRCA-RNASEQ',
    )
    const newStudyLinks = screen.getAllByRole('link', { name: 'New study' })
    expect(newStudyLinks).toHaveLength(2)
    for (const link of newStudyLinks) {
      expect(link).toHaveAttribute('href', '/projects/TCGA-BRCA/studies/new')
    }

    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByRole('link', { name: 'Edit project' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/edit',
    )
  })

  it('says when the project has no studies', async () => {
    respondByPath({
      [projectPath]: Response.json({ ...tcga, description: null }),
      [studiesPath]: Response.json([]),
    })
    renderPage()

    expect(await screen.findByText('No studies in this project yet.')).toBeInTheDocument()
  })

  it('says when the project does not exist', async () => {
    respondByPath({})
    renderPage('NOPE')

    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
  })

  it('shows an error when the project cannot be loaded', async () => {
    respondByPath({ [projectPath]: Response.json({ detail: 'Internal error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load project')
  })

  it('shows an error when the studies cannot be loaded', async () => {
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studiesPath]: Response.json({ detail: 'Internal error' }, { status: 500 }),
    })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load studies')
  })
})
