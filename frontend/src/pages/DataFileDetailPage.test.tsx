import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import DataFileDetailPage from './DataFileDetailPage'

type DataFile = components['schemas']['DataFileRead']
type DataFileSample = components['schemas']['DataFileSampleRead']
type DataFileSummary = components['schemas']['DataFileSummary']

const counts: DataFile = {
  id: '0192a5b0-0000-7000-8000-000000000030',
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  assay_id: '0192a5b0-0000-7000-8000-000000000020',
  name: 'counts.tsv',
  external_id: 'GDC-FILE-01',
  level: 'processed',
  format: 'TSV',
  uri: 'https://api.gdc.cancer.gov/data/0004d251-3f70-4395-b175-c94c2f5b1b81',
  size_bytes: 2_500_000,
  sha256: 'a'.repeat(64),
  summary: { genes: 60483 },
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  assay_name: 'RNA-seq batch 1',
  sample_count: 1,
}

const bare: DataFile = {
  ...counts,
  uri: 's3://protolims-data/RNASEQ/counts.tsv',
  external_id: null,
  assay_id: null,
  assay_name: null,
  size_bytes: null,
  sha256: null,
  summary: {},
  sample_count: 0,
}

const tumourRna: DataFileSample = {
  sample_id: '0192a5b0-0000-7000-8000-000000000011',
  sample_name: 'Tumour-01-RNA',
  external_id: null,
  material_type: 'RNA',
  status: 'in_use',
  label: 'column 1',
}

const bam: DataFileSummary = {
  id: '0192a5b0-0000-7000-8000-000000000031',
  name: 'aligned.bam',
  level: 'processed',
  format: 'BAM',
  uri: 's3://protolims-data/RNASEQ/aligned.bam',
}

const report: DataFileSummary = {
  id: '0192a5b0-0000-7000-8000-000000000032',
  name: 'report.html',
  level: 'analysis',
  format: 'HTML',
  uri: 'https://example.org/report.html',
}

const error = () => Response.json({ detail: 'Error' }, { status: 500 })

// Answers the file request and its samples, inputs and outputs requests with fresh responses.
// Returns the query of each samples request.
function stubApi({
  file = () => Response.json(counts),
  samples = () => Response.json({ items: [tumourRna], total: 1 }),
  inputs = () => Response.json([bam]),
  outputs = () => Response.json([report]),
}: {
  file?: () => Response
  samples?: (query: URLSearchParams) => Response
  inputs?: () => Response
  outputs?: () => Response
} = {}) {
  const sampleQueries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/samples')) {
        sampleQueries.push(url.searchParams)
        return Promise.resolve(samples(url.searchParams))
      }
      if (url.pathname.endsWith('/inputs')) {
        return Promise.resolve(inputs())
      }
      if (url.pathname.endsWith('/outputs')) {
        return Promise.resolve(outputs())
      }
      return Promise.resolve(file())
    }),
  )
  return sampleQueries
}

function renderPage(id = counts.id) {
  render(
    <TestProviders route={`/data-files/${id}`}>
      <Routes>
        <Route path="/data-files/:dataFileId" element={<DataFileDetailPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('DataFileDetailPage', () => {
  it('shows the file, where it is, its samples and the files it was made from and used for', async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading data file…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /counts\.tsv/ })).toBeInTheDocument()
    expect(screen.getByText('Data file:')).toBeInTheDocument()

    const details = within(screen.getByRole('region', { name: 'Details' }))
    expect(details.getByRole('link', { name: counts.uri })).toHaveAttribute('href', counts.uri)
    expect(details.getByText('Processed')).toBeInTheDocument()
    expect(details.getByText('TSV')).toBeInTheDocument()
    expect(details.getByText('2.5 MB')).toBeInTheDocument()
    expect(details.getByText('a'.repeat(64))).toBeInTheDocument()
    expect(details.getByText('GDC-FILE-01')).toBeInTheDocument()
    expect(details.getByRole('link', { name: 'RNA-seq batch 1' })).toHaveAttribute(
      'href',
      `/assays/${counts.assay_id ?? ''}`,
    )
    expect(details.getByRole('link', { name: 'Edit data file' })).toHaveAttribute(
      'href',
      `/data-files/${counts.id}/edit`,
    )
    expect(screen.getByText('genes:')).toBeInTheDocument()
    expect(screen.getByText('60483')).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )

    expect(await screen.findByRole('link', { name: 'Tumour-01-RNA' })).toHaveAttribute(
      'href',
      `/samples/${tumourRna.sample_id}`,
    )
    expect(screen.getByRole('cell', { name: 'column 1' })).toBeInTheDocument()

    const madeFrom = within(await screen.findByRole('table', { name: 'Made from' }))
    expect(madeFrom.getByRole('link', { name: 'aligned.bam' })).toHaveAttribute(
      'href',
      `/data-files/${bam.id}`,
    )
    expect(madeFrom.getByText(bam.uri)).toBeInTheDocument()

    const usedToMake = within(await screen.findByRole('table', { name: 'Used to make' }))
    expect(usedToMake.getByRole('link', { name: 'report.html' })).toHaveAttribute(
      'href',
      `/data-files/${report.id}`,
    )
    expect(usedToMake.getByText('Analysis · HTML')).toBeInTheDocument()
  })

  it('shows a storage location as text, leaves out missing details and says what is empty', async () => {
    stubApi({
      file: () => Response.json(bare),
      samples: () => Response.json({ items: [], total: 0 }),
      inputs: () => Response.json([]),
      outputs: () => Response.json([]),
    })
    renderPage()

    expect(await screen.findByText(bare.uri)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: bare.uri })).not.toBeInTheDocument()
    for (const label of ['Size:', 'SHA-256:', 'Assay:', 'External ID:']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(screen.getByText('No summary recorded.')).toBeInTheDocument()
    expect(await screen.findByText('No samples linked to this file yet.')).toBeInTheDocument()
    expect(await screen.findByText('Not recorded as made from other files.')).toBeInTheDocument()
    expect(await screen.findByText('No files recorded as made from this one.')).toBeInTheDocument()
  })

  it("shows its assay's samples when it has none of its own", async () => {
    const spectra = { ...counts, name: 'f01.raw', assay_name: 'Plex 1', sample_count: 0 }
    const sampleRequests: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) => {
        const url = new URL(request.url)
        if (url.pathname.endsWith('/samples')) {
          sampleRequests.push(url.pathname)
          return Promise.resolve(Response.json({ items: [tumourRna], total: 1 }))
        }
        if (url.pathname.endsWith('/inputs') || url.pathname.endsWith('/outputs')) {
          return Promise.resolve(Response.json([]))
        }
        return Promise.resolve(Response.json(spectra))
      }),
    )
    renderPage()

    expect(await screen.findByText(/has no samples of its own/)).toHaveTextContent(
      'This file has no samples of its own, so it holds the data of all the samples of its ' +
        'assay, Plex 1.',
    )
    expect(await screen.findByRole('link', { name: 'Tumour-01-RNA' })).toBeInTheDocument()
    // Only the assay's samples are asked for, not the file's.
    expect([...new Set(sampleRequests)]).toEqual([
      `/api/v1/assays/${counts.assay_id ?? ''}/samples`,
    ])
  })

  it('sorts and searches its samples', async () => {
    const sampleQueries = stubApi({
      samples: (query) =>
        query.get('q') === 'zzz'
          ? Response.json({ items: [], total: 0 })
          : Response.json({ items: [tumourRna], total: 1 }),
    })
    const user = userEvent.setup()
    renderPage()

    const samples = within(await screen.findByRole('table', { name: 'Samples' }))
    await user.click(samples.getByRole('button', { name: 'Label' }))
    await waitFor(() => {
      expect(sampleQueries.at(-1)?.get('sort')).toBe('label')
    })

    await user.type(screen.getByRole('searchbox', { name: 'Search samples' }), 'zzz')
    expect(await screen.findByText('No samples match “zzz”.')).toBeInTheDocument()
  })

  it('says when there is no such data file', async () => {
    stubApi({ file: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Data file not found' })).toBeInTheDocument()
  })

  it('treats an invalid ID like an unknown one', async () => {
    stubApi({ file: () => Response.json({ detail: [] }, { status: 422 }) })
    renderPage('not-a-uuid')

    expect(await screen.findByRole('heading', { name: 'Data file not found' })).toBeInTheDocument()
  })

  it('shows an error when the data file cannot be loaded', async () => {
    stubApi({ file: error })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load data file')
  })

  it('shows an error when its samples cannot be loaded', async () => {
    stubApi({ samples: error })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load samples')
  })

  it('shows an error when the files it was made from cannot be loaded', async () => {
    stubApi({ inputs: error })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the files it was made from.',
    )
  })

  it('shows an error when the files made from it cannot be loaded', async () => {
    stubApi({ outputs: error })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the files made from it.',
    )
  })
})
