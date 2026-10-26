import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import EditAssayPage from './EditAssayPage'

type Assay = components['schemas']['AssayRead']

const run: Assay = {
  id: '0192a5b0-0000-7000-8000-000000000020',
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  name: 'Run-01',
  external_id: 'GDC-RG-01',
  measurement_type: 'transcription profiling',
  technology_type: 'nucleotide sequencing',
  platform: 'Illumina HiSeq 2000',
  performed_at: '2026-10-01T09:00:00Z',
  parameters: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  sample_count: 0,
}

// A GET loads the assay; a PATCH saves changes.
function stubApi({
  assay = () => Response.json(run),
  update = () => Response.json(run),
}: {
  assay?: () => Response
  update?: (request: Request) => Response | Promise<Response>
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      request.method === 'PATCH' ? Promise.resolve(update(request)) : Promise.resolve(assay()),
    ),
  )
}

function renderPage() {
  render(
    <TestProviders route={`/assays/${run.id}/edit`}>
      <Routes>
        <Route path="/assays/:assayId/edit" element={<EditAssayPage />} />
        <Route path="/assays/:assayId" element={<h1>Assay page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

describe('EditAssayPage', () => {
  it("shows the assay's current details", async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading assay…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Name')).toHaveValue('Run-01')
    expect(screen.getByText('Edit assay:')).toBeInTheDocument()
    expect(screen.getByLabelText('Measurement type')).toHaveValue('transcription profiling')
    expect(screen.getByLabelText('Technology type')).toHaveValue('nucleotide sequencing')
    expect(screen.getByLabelText(/platform/i)).toHaveValue('Illumina HiSeq 2000')
    expect(screen.getByLabelText(/performed/i)).toHaveValue('2026-10-01')
    expect(screen.getByLabelText(/external id/i)).toHaveValue('GDC-RG-01')

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/assays/${run.id}`,
    )
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'Run-01' })).toHaveAttribute(
      'href',
      `/assays/${run.id}`,
    )
  })

  it('saves only the changed fields, then goes back to the assay', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(run)
      },
    })
    const user = userEvent.setup()
    renderPage()

    const platform = await screen.findByLabelText(/platform/i)
    await user.clear(platform)
    await user.type(platform, 'NovaSeq 6000')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'Assay page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ platform: 'NovaSeq 6000' })
  })

  it('sends a changed date, and clears an emptied field', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(run)
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.clear(await screen.findByLabelText(/external id/i))
    fireEvent.change(screen.getByLabelText(/performed/i), { target: { value: '2026-10-02' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'Assay page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ external_id: null, performed_at: '2026-10-02T12:00:00Z' })
  })

  it('shows that the changes are being saved', async () => {
    stubApi({ update: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('highlights the name when it is already used', async () => {
    stubApi({ update: () => Response.json({ detail: 'Exists' }, { status: 409 }) })
    const user = userEvent.setup()
    renderPage()

    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Run-02')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An assay called Run-02 already exists in this study.',
    )
    expect(name).toHaveAttribute('aria-invalid', 'true')
  })

  it('says when the details are not valid', async () => {
    stubApi({ update: () => Response.json({ detail: [] }, { status: 422 }) })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')
  })

  it('shows an error when the changes cannot be saved', async () => {
    stubApi({ update: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes.')
  })

  it('says when there is no such assay', async () => {
    stubApi({ assay: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Assay not found' })).toBeInTheDocument()
  })

  it('shows an error when the assay cannot be loaded', async () => {
    stubApi({ assay: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load assay')
  })
})
