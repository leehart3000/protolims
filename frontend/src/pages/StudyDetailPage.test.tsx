import { render, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import StudyDetailPage from './StudyDetailPage'

type Study = components['schemas']['StudyRead']

const rnaseq: Study = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: '0192a5b0-0000-7000-8000-000000000001',
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

function respondWith(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
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
  it('shows the study and its design factors', async () => {
    respondWith(Response.json(rnaseq))
    renderPage()

    expect(screen.getByText('Loading study…')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'RNA-seq of primary tumours' }),
    ).toBeInTheDocument()
    expect(screen.getByText('TCGA-BRCA / RNASEQ')).toBeInTheDocument()
    expect(
      screen.getByText('Gene expression in tumour and matched normal tissue.'),
    ).toBeInTheDocument()
    expect(screen.getByText('23 October 2026')).toBeInTheDocument()
    expect(screen.getByText('sample type')).toBeInTheDocument()
    expect(screen.getByText('stage')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Back to project' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA',
    )
  })

  it('says when there are no design factors', async () => {
    respondWith(Response.json({ ...rnaseq, description: null, design_factors: [] }))
    renderPage()

    expect(await screen.findByText('No design factors recorded.')).toBeInTheDocument()
  })

  it('says when the study does not exist', async () => {
    respondWith(Response.json({ detail: 'Not Found' }, { status: 404 }))
    renderPage('NOPE')

    expect(await screen.findByRole('heading', { name: 'Study not found' })).toBeInTheDocument()
  })

  it('shows an error when the study cannot be loaded', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load study')
  })
})
