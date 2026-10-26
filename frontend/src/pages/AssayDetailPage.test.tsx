import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import AssayDetailPage from './AssayDetailPage'

type Assay = components['schemas']['AssayRead']
type AssaySample = components['schemas']['AssaySampleRead']

const assayId = '0192a5b0-0000-7000-8000-000000000020'

const rnaseq: Assay = {
  id: assayId,
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  name: 'RNA-seq batch 1',
  external_id: 'GDC-RG-01',
  measurement_type: 'transcription profiling',
  technology_type: 'nucleotide sequencing',
  platform: 'Illumina HiSeq 2000',
  performed_at: '2026-10-01T09:00:00Z',
  parameters: { 'read length': 50 },
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  sample_count: 1,
}

const tumourRna: AssaySample = {
  sample_id: '0192a5b0-0000-7000-8000-000000000011',
  sample_name: 'Tumour-01-RNA',
  external_id: null,
  material_type: 'RNA',
  status: 'in_use',
  label: '126',
}

const samplesPath = `/api/v1/assays/${assayId}/samples`

// Answers the assay request with `assayResponse`, and the samples request with `samples`.
// Returns the query of each samples request.
function respondWith(
  assayResponse: Response,
  samples: (query: URLSearchParams) => Response = () => Response.json({ items: [], total: 0 }),
) {
  const sampleQueries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === samplesPath) {
        sampleQueries.push(url.searchParams)
        return Promise.resolve(samples(url.searchParams))
      }
      return Promise.resolve(assayResponse)
    }),
  )
  return sampleQueries
}

function renderPage(id = assayId) {
  render(
    <TestProviders route={`/assays/${id}`}>
      <Routes>
        <Route path="/assays/:assayId" element={<AssayDetailPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('AssayDetailPage', () => {
  it('shows the assay, where it belongs, its parameters and its samples', async () => {
    respondWith(Response.json(rnaseq), () => Response.json({ items: [tumourRna], total: 1 }))
    renderPage()

    expect(screen.getByText('Loading assay…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /RNA-seq batch 1/ })).toBeInTheDocument()
    expect(screen.getByText('Assay:')).toBeInTheDocument()
    expect(screen.getByText('transcription profiling')).toBeInTheDocument()
    expect(screen.getByText('nucleotide sequencing')).toBeInTheDocument()
    expect(screen.getByText('Illumina HiSeq 2000')).toBeInTheDocument()
    expect(screen.getByText('1 October 2026')).toBeInTheDocument()
    expect(screen.getByText('GDC-RG-01')).toBeInTheDocument()
    expect(screen.getByText('24 October 2026')).toBeInTheDocument()
    expect(screen.getByText('read length:')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
    expect(within(trail).getByText('RNA-seq batch 1')).toHaveAttribute('aria-current', 'page')

    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByRole('link', { name: 'Edit assay' })).toHaveAttribute(
      'href',
      `/assays/${assayId}/edit`,
    )

    expect(await screen.findByRole('link', { name: 'Tumour-01-RNA' })).toHaveAttribute(
      'href',
      `/samples/${tumourRna.sample_id}`,
    )
    expect(screen.getByRole('cell', { name: '126' })).toBeInTheDocument()
    expect(screen.getByText('126 · RNA · In use')).toBeInTheDocument()
  })

  it('leaves out missing details and says when there are no parameters or samples', async () => {
    respondWith(
      Response.json({
        ...rnaseq,
        platform: null,
        performed_at: null,
        external_id: null,
        parameters: {},
        sample_count: 0,
      }),
    )
    renderPage()

    expect(await screen.findByText('No parameters recorded.')).toBeInTheDocument()
    expect(screen.queryByText('Platform:')).not.toBeInTheDocument()
    expect(screen.queryByText('Performed:')).not.toBeInTheDocument()
    expect(screen.queryByText('External ID:')).not.toBeInTheDocument()
    expect(await screen.findByText('No samples linked to this assay yet.')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('sorts and searches its samples', async () => {
    const sampleQueries = respondWith(Response.json(rnaseq), (query) =>
      query.get('q') === 'zzz'
        ? Response.json({ items: [], total: 0 })
        : Response.json({ items: [tumourRna], total: 1 }),
    )
    const user = userEvent.setup()
    renderPage()

    const samples = within(await screen.findByRole('table', { name: 'Samples' }))
    await user.click(samples.getByRole('button', { name: 'Label' }))
    await waitFor(() => {
      expect(sampleQueries.at(-1)?.get('sort')).toBe('label')
    })

    await user.type(screen.getByRole('searchbox', { name: 'Search samples' }), 'zzz')
    expect(await screen.findByText('No samples match “zzz”.')).toBeInTheDocument()
    expect(sampleQueries.at(-1)?.get('q')).toBe('zzz')
  })

  it('says when there is no such assay', async () => {
    respondWith(Response.json({ detail: 'Not Found' }, { status: 404 }))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Assay not found' })).toBeInTheDocument()
  })

  it('treats an invalid ID like an unknown one', async () => {
    respondWith(Response.json({ detail: [] }, { status: 422 }))
    renderPage('not-a-uuid')

    expect(await screen.findByRole('heading', { name: 'Assay not found' })).toBeInTheDocument()
  })

  it('shows an error when the assay cannot be loaded', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load assay')
  })

  it('shows an error when its samples cannot be loaded', async () => {
    respondWith(Response.json(rnaseq), () =>
      Response.json({ detail: 'Internal error' }, { status: 500 }),
    )
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load samples')
  })
})
