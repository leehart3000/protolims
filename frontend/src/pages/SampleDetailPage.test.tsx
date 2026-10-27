import { render, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import SampleDetailPage from './SampleDetailPage'

type Sample = components['schemas']['SampleRead']
type SampleAssay = components['schemas']['SampleAssayRead']
type SampleDataFile = components['schemas']['SampleDataFileRead']

const tumour: Sample = {
  id: '0192a5b0-0000-7000-8000-000000000010',
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  name: 'Tumour-01',
  external_id: 'GDC-SAMPLE-UUID',
  subject_id: '0192a5b0-0000-7000-8000-000000000005',
  parent_sample_id: null,
  material_type: 'tissue',
  status: 'in_storage',
  collected_at: '2026-10-01T09:00:00Z',
  characteristics: { 'tissue site': 'breast' },
  factor_values: { treatment: 'none' },
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  subject_name: 'Patient-01',
  parent_sample_name: null,
}

const rna: Sample = {
  ...tumour,
  id: '0192a5b0-0000-7000-8000-000000000011',
  name: 'Tumour-01-RNA',
  external_id: null,
  subject_id: null,
  subject_name: null,
  parent_sample_id: tumour.id,
  parent_sample_name: 'Tumour-01',
  material_type: 'RNA',
  status: 'registered',
  collected_at: null,
  characteristics: {},
  factor_values: {},
}

const proteomics: SampleAssay = {
  assay_id: '0192a5b0-0000-7000-8000-000000000020',
  assay_name: 'Proteomics run 1',
  measurement_type: 'protein expression profiling',
  technology_type: 'mass spectrometry',
  platform: 'Orbitrap',
  label: '126',
}

const counts: SampleDataFile = {
  data_file_id: '0192a5b0-0000-7000-8000-000000000030',
  name: 'counts.tsv',
  level: 'processed',
  format: 'TSV',
  uri: 'https://example.org/counts.tsv',
  label: 'column 1',
}

const samplesPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ/samples'

function assaysPath(sample: Sample) {
  return `/api/v1/samples/${sample.id}/assays`
}

function dataFilesPath(sample: Sample) {
  return `/api/v1/samples/${sample.id}/data-files`
}

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

function renderPage(id: string) {
  render(
    <TestProviders route={`/samples/${id}`}>
      <Routes>
        <Route path="/samples/:sampleId" element={<SampleDetailPage />} />
      </Routes>
    </TestProviders>,
  )
}

describe('SampleDetailPage', () => {
  it('shows the sample, its subject, its data, what was derived from it and its assays', async () => {
    respondByPath({
      [`/api/v1/samples/${tumour.id}`]: Response.json(tumour),
      [samplesPath]: Response.json({ items: [rna], total: 1 }),
      [assaysPath(tumour)]: Response.json([proteomics]),
      [dataFilesPath(tumour)]: Response.json([counts]),
    })
    renderPage(tumour.id)

    expect(screen.getByText('Loading sample…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /Tumour-01/ })).toBeInTheDocument()
    expect(screen.getByText('Sample:')).toBeInTheDocument()
    expect(screen.getByText('In storage')).toBeInTheDocument()
    expect(screen.getByText('1 October 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Patient-01' })).toHaveAttribute(
      'href',
      `/subjects/${tumour.subject_id ?? ''}`,
    )

    const details = screen.getByRole('region', { name: 'Details' })
    expect(within(details).getByRole('link', { name: 'Edit sample' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}/edit`,
    )

    expect(screen.getByText('GDC-SAMPLE-UUID')).toBeInTheDocument()
    expect(screen.getByText('breast')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Tumour-01-RNA' })).toHaveAttribute(
      'href',
      `/samples/${rna.id}`,
    )

    const newDerivedLinks = screen.getAllByRole('link', { name: 'New derived sample' })
    expect(newDerivedLinks).toHaveLength(2)
    for (const link of newDerivedLinks) {
      expect(link).toHaveAttribute(
        'href',
        `/projects/TCGA-BRCA/studies/RNASEQ/samples/new?parent=${tumour.id}`,
      )
    }

    const assays = within(await screen.findByRole('table', { name: 'Assays' }))
    expect(assays.getByRole('link', { name: 'Proteomics run 1' })).toHaveAttribute(
      'href',
      `/assays/${proteomics.assay_id}`,
    )
    expect(assays.getByRole('cell', { name: '126' })).toBeInTheDocument()
    expect(assays.getByText('126 · protein expression profiling · Orbitrap')).toBeInTheDocument()

    const files = within(await screen.findByRole('table', { name: 'Data files' }))
    expect(files.getByRole('link', { name: 'counts.tsv' })).toHaveAttribute(
      'href',
      `/data-files/${counts.data_file_id}`,
    )
    expect(files.getByRole('cell', { name: 'column 1' })).toBeInTheDocument()
    expect(files.getByText('column 1 · Processed · TSV')).toBeInTheDocument()

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'RNASEQ' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
  })

  it('links a derived sample to its parent and leaves out missing details', async () => {
    respondByPath({
      [`/api/v1/samples/${rna.id}`]: Response.json(rna),
      [samplesPath]: Response.json({ items: [], total: 0 }),
      [assaysPath(rna)]: Response.json([]),
      [dataFilesPath(rna)]: Response.json([]),
    })
    renderPage(rna.id)

    expect(await screen.findByRole('link', { name: 'Tumour-01' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}`,
    )

    for (const link of screen.getAllByRole('link', { name: 'New derived sample' })) {
      expect(link).toHaveAttribute(
        'href',
        `/projects/TCGA-BRCA/studies/RNASEQ/samples/new?parent=${rna.id}`,
      )
    }

    expect(screen.queryByText('Subject:')).not.toBeInTheDocument()
    expect(screen.queryByText('Collected:')).not.toBeInTheDocument()
    expect(screen.getByText('No characteristics recorded.')).toBeInTheDocument()
    expect(screen.getByText('No factor values recorded.')).toBeInTheDocument()
    expect(
      await screen.findByText('No samples have been derived from this one yet.'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Not measured in any assays yet.')).toBeInTheDocument()
    expect(await screen.findByText('Not in any data files yet.')).toBeInTheDocument()
  })

  it('says when there is no such sample, or the ID is invalid', async () => {
    respondByPath({})
    renderPage(tumour.id)
    expect(await screen.findByRole('heading', { name: 'Sample not found' })).toBeInTheDocument()
  })

  it('treats an invalid ID like an unknown one', async () => {
    respondByPath({ '/api/v1/samples/not-a-uuid': Response.json({ detail: [] }, { status: 422 }) })
    renderPage('not-a-uuid')
    expect(await screen.findByRole('heading', { name: 'Sample not found' })).toBeInTheDocument()
  })

  it('shows an error when the sample cannot be loaded', async () => {
    respondByPath({
      [`/api/v1/samples/${tumour.id}`]: Response.json({ detail: 'Error' }, { status: 500 }),
    })
    renderPage(tumour.id)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load sample')
  })

  it('shows an error when the derived samples cannot be loaded', async () => {
    respondByPath({
      [`/api/v1/samples/${tumour.id}`]: Response.json(tumour),
      [samplesPath]: Response.json({ detail: 'Error' }, { status: 500 }),
      [assaysPath(tumour)]: Response.json([]),
      [dataFilesPath(tumour)]: Response.json([]),
    })
    renderPage(tumour.id)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load derived samples')
  })

  it('shows an error when the assays cannot be loaded', async () => {
    respondByPath({
      [`/api/v1/samples/${tumour.id}`]: Response.json(tumour),
      [samplesPath]: Response.json({ items: [], total: 0 }),
      [assaysPath(tumour)]: Response.json({ detail: 'Error' }, { status: 500 }),
      [dataFilesPath(tumour)]: Response.json([]),
    })
    renderPage(tumour.id)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load assays')
  })

  it('shows an error when the data files cannot be loaded', async () => {
    respondByPath({
      [`/api/v1/samples/${tumour.id}`]: Response.json(tumour),
      [samplesPath]: Response.json({ items: [], total: 0 }),
      [assaysPath(tumour)]: Response.json([]),
      [dataFilesPath(tumour)]: Response.json({ detail: 'Error' }, { status: 500 }),
    })
    renderPage(tumour.id)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load data files')
  })
})
