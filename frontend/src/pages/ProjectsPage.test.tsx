import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import ProjectsPage from './ProjectsPage'

type Project = components['schemas']['ProjectRead']

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

function respondWith(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  )
}

function renderPage() {
  render(
    <TestProviders route="/projects">
      <ProjectsPage />
    </TestProviders>,
  )
}

describe('ProjectsPage', () => {
  it('shows a loading message, then the projects', async () => {
    respondWith(Response.json([tcga]))
    renderPage()

    expect(screen.getByText('Loading projects…')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'TCGA-BRCA' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'TCGA Breast Invasive Carcinoma' })).toBeInTheDocument()
  })

  it('says when there are no projects', async () => {
    respondWith(Response.json([]))
    renderPage()

    expect(await screen.findByText('No projects yet.')).toBeInTheDocument()
  })

  it('shows an error when the API fails', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load projects')
  })
})
