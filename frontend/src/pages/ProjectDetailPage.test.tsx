import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// Answers the project request with TCGA-BRCA, and each studies request with a fresh page from
// `respond`. Returns each studies request's query.
function stubStudies(respond: (query: URLSearchParams) => { items: Study[]; total: number }) {
  const queries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname !== studiesPath) {
        return Promise.resolve(Response.json(tcga))
      }
      queries.push(url.searchParams)
      return Promise.resolve(Response.json(respond(url.searchParams)))
    }),
  )
  return queries
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
    respondByPath({
      [projectPath]: Response.json(tcga),
      [studiesPath]: Response.json({ items: [rnaseq], total: 1 }),
    })
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
    const newStudyLinks = screen.getAllByRole('link', { name: /^(Add|New) study$/ })
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
      [studiesPath]: Response.json({ items: [], total: 0 }),
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

  it("sorts and searches the project's studies", async () => {
    const queries = stubStudies((query) =>
      query.get('q') === 'zzz' ? { items: [], total: 0 } : { items: [rnaseq], total: 1 },
    )
    const user = userEvent.setup()
    renderPage()

    const studies = within(await screen.findByRole('table', { name: 'Studies' }))
    expect(queries.at(-1)?.get('sort')).toBe('code')
    await user.click(studies.getByRole('button', { name: 'Title' }))
    await waitFor(() => {
      expect(queries.at(-1)?.get('sort')).toBe('title')
    })

    await user.type(screen.getByRole('searchbox', { name: 'Search studies' }), 'zzz')
    expect(await screen.findByText('No studies match “zzz”.')).toBeInTheDocument()
    expect(queries.at(-1)?.get('q')).toBe('zzz')
  })
})
