import { render, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import SubjectDetailPage from './SubjectDetailPage'

type Subject = components['schemas']['SubjectRead']

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

function respondWith(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  )
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
  it('shows the subject, where it belongs and its attributes', async () => {
    respondWith(Response.json(patient))
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
  })

  it('leaves out missing details and says when there are no attributes', async () => {
    respondWith(Response.json({ ...patient, species: null, external_id: null, attributes: {} }))
    renderPage()

    expect(await screen.findByText('No attributes recorded.')).toBeInTheDocument()
    expect(screen.queryByText('Species:')).not.toBeInTheDocument()
    expect(screen.queryByText('External ID:')).not.toBeInTheDocument()
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
