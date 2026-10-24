import { render, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import StudiesPage from './StudiesPage'

type Project = components['schemas']['ProjectRead']
type StudyWithProject = components['schemas']['StudyWithProjectRead']

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

const tcgaRnaseq: StudyWithProject = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: tcga.id,
  code: 'RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: null,
  design_factors: [],
  created_at: '2026-10-23T12:00:00Z',
  updated_at: '2026-10-23T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  project_name: 'TCGA Breast Invasive Carcinoma',
}

const cptacPilot: StudyWithProject = {
  ...tcgaRnaseq,
  id: '0192a5b0-0000-7000-8000-000000000004',
  project_id: '0192a5b0-0000-7000-8000-000000000003',
  code: 'PILOT',
  title: 'Pilot',
  project_code: 'CPTAC-BRCA',
  project_name: 'CPTAC Breast Cancer',
}

// Answers the studies list with the given response, and any project request with TCGA-BRCA.
// Returns the requested URLs, so tests can check what was asked for.
function respondWith(studiesResponse: Response) {
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      requested.push(request.url)
      const isStudiesList = new URL(request.url).pathname === '/api/v1/studies'
      return Promise.resolve(isStudiesList ? studiesResponse : Response.json(tcga))
    }),
  )
  return requested
}

function renderPage(route = '/studies') {
  render(
    <TestProviders route={route}>
      <Routes>
        <Route path="/studies" element={<StudiesPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('StudiesPage', () => {
  it('lists studies from every project', async () => {
    respondWith(Response.json([cptacPilot, tcgaRnaseq]))
    renderPage()

    expect(screen.getByText('Loading studies…')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'CPTAC-BRCA' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'RNA-seq of primary tumours' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
    expect(screen.getByText('RNASEQ · TCGA-BRCA')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New study' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'All studies' })).not.toBeInTheDocument()
  })

  it("can show just one project's studies", async () => {
    const requested = respondWith(Response.json([tcgaRnaseq]))
    renderPage('/studies?project=TCGA-BRCA')

    expect(
      await screen.findByRole('link', { name: 'RNA-seq of primary tumours' }),
    ).toBeInTheDocument()
    expect(requested.some((url) => url.includes('/api/v1/studies?project=TCGA-BRCA'))).toBe(true)
    expect(await screen.findByText('TCGA Breast Invasive Carcinoma')).toBeInTheDocument()
    expect(screen.getByText('Project code:')).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'TCGA-BRCA' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA',
    )
    const allStudiesLinks = screen.getAllByRole('link', { name: 'All studies' })
    expect(allStudiesLinks).toHaveLength(2)
    for (const link of allStudiesLinks) {
      expect(link).toHaveAttribute('href', '/studies')
    }
    const newStudyLinks = screen.getAllByRole('link', { name: 'New study' })
    expect(newStudyLinks).toHaveLength(2)
    for (const link of newStudyLinks) {
      expect(link).toHaveAttribute('href', '/projects/TCGA-BRCA/studies/new')
    }
  })

  it('says when there are no studies', async () => {
    respondWith(Response.json([]))
    renderPage()

    expect(await screen.findByText('No studies yet.')).toBeInTheDocument()
  })

  it('says when a project has no studies', async () => {
    respondWith(Response.json([]))
    renderPage('/studies?project=TCGA-BRCA')

    expect(await screen.findByText('No studies in this project yet.')).toBeInTheDocument()
  })

  it('shows an error when the API fails', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load studies')
  })
})
