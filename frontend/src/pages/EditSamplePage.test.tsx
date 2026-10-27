import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import EditSamplePage from './EditSamplePage'

type Subject = components['schemas']['SubjectRead']
type Sample = components['schemas']['SampleRead']

const patient: Subject = {
  id: '0192a5b0-0000-7000-8000-000000000005',
  study_id: '0192a5b0-0000-7000-8000-000000000002',
  name: 'TCGA-A1-A0SB',
  external_id: null,
  subject_type: 'patient',
  species: 'Homo sapiens',
  attributes: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
}

const tumour: Sample = {
  id: '0192a5b0-0000-7000-8000-000000000010',
  study_id: patient.study_id,
  name: 'Tumour-01',
  external_id: 'GDC-1',
  subject_id: patient.id,
  parent_sample_id: null,
  material_type: 'tissue',
  status: 'in_storage',
  collected_at: '2026-10-01T09:00:00Z',
  characteristics: {},
  factor_values: {},
  created_at: '2026-10-24T12:00:00Z',
  updated_at: '2026-10-24T12:00:00Z',
  created_by: null,
  project_code: 'TCGA-BRCA',
  study_code: 'RNASEQ',
  subject_name: 'TCGA-A1-A0SB',
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
}

const rnaAliquot: Sample = {
  ...rna,
  id: '0192a5b0-0000-7000-8000-000000000013',
  name: 'Tumour-01-RNA-1',
  parent_sample_id: rna.id,
  parent_sample_name: 'Tumour-01-RNA',
}

const normal: Sample = {
  ...tumour,
  id: '0192a5b0-0000-7000-8000-000000000012',
  name: 'Normal-01',
  external_id: null,
}

const studyPath = '/api/v1/projects/TCGA-BRCA/studies/RNASEQ'

// GET requests load the sample and the study's subjects and samples; a PATCH saves changes.
function stubApi({
  sample = () => Response.json(tumour),
  update = () => Response.json(tumour),
  samples = () => Response.json({ items: [rnaAliquot, tumour, rna, normal], total: 4 }),
}: {
  sample?: () => Response
  update?: (request: Request) => Response | Promise<Response>
  samples?: () => Response
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const path = new URL(request.url).pathname
      if (request.method === 'PATCH') {
        return Promise.resolve(update(request))
      }
      if (path === `${studyPath}/subjects`) {
        return Promise.resolve(Response.json({ items: [patient], total: 1 }))
      }
      if (path === `${studyPath}/samples`) {
        return Promise.resolve(samples())
      }
      return Promise.resolve(sample())
    }),
  )
}

function renderPage(id = tumour.id) {
  render(
    <TestProviders route={`/samples/${id}/edit`}>
      <Routes>
        <Route path="/samples/:sampleId/edit" element={<EditSamplePage />} />
        <Route path="/samples/:sampleId" element={<h1>Sample page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

describe('EditSamplePage', () => {
  it("shows the sample's current details", async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading sample…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Name')).toHaveValue('Tumour-01')
    expect(screen.getByText('Edit sample:')).toBeInTheDocument()
    expect(screen.getByLabelText('Material')).toHaveValue('tissue')
    expect(screen.getByLabelText('Status')).toHaveValue('in_storage')
    expect(screen.getByLabelText(/subject/i)).toHaveValue(patient.id)
    expect(screen.getByLabelText(/collected/i)).toHaveValue('2026-10-01')
    expect(screen.getByLabelText(/external id/i)).toHaveValue('GDC-1')

    const parent = within(screen.getByLabelText(/derived from/i))
    expect(parent.getByRole('option', { name: 'Normal-01 (tissue)' })).toBeInTheDocument()
    for (const excluded of ['Tumour-01 (tissue)', 'Tumour-01-RNA (RNA)', 'Tumour-01-RNA-1 (RNA)']) {
      expect(parent.queryByRole('option', { name: excluded })).not.toBeInTheDocument()
    }

    expect(screen.getByLabelText(/derived from/i)).toHaveAccessibleDescription(
      /aren't listed, as a sample can't be derived from itself/,
    )

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}`,
    )
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'Tumour-01' })).toHaveAttribute(
      'href',
      `/samples/${tumour.id}`,
    )
  })

  it('shows a derived sample with no subject or collection date', async () => {
    stubApi({ sample: () => Response.json(rna) })
    renderPage(rna.id)

    expect(await screen.findByLabelText(/derived from/i)).toHaveValue(tumour.id)
    expect(screen.getByLabelText(/subject/i)).toHaveValue('')
    expect(screen.getByLabelText(/collected/i)).toHaveValue('')
    expect(screen.getByLabelText(/external id/i)).toHaveValue('')
  })

  it('saves only the changed fields, then goes back to the sample', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json({ ...tumour, status: 'in_use' })
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Status'), 'in_use')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'Sample page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ status: 'in_use' })
  })

  it('sends a changed collection date, and clears an emptied field', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(tumour)
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.clear(await screen.findByLabelText(/external id/i))
    fireEvent.change(screen.getByLabelText(/collected/i), { target: { value: '2026-10-02' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { name: 'Sample page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ external_id: null, collected_at: '2026-10-02T12:00:00Z' })
  })

  it('shows that the changes are being saved', async () => {
    stubApi({ update: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('highlights the name when it is already used, and clears it on change', async () => {
    stubApi({ update: () => Response.json({ detail: 'Exists' }, { status: 409 }) })
    const user = userEvent.setup()
    renderPage()

    const name = await screen.findByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Tumour-02')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A sample called Tumour-02 already exists in this study.',
    )
    expect(name).toHaveAttribute('aria-invalid', 'true')

    await user.type(name, '-x')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("shows the API's explanation when a change breaks a rule", async () => {
    stubApi({
      update: () =>
        Response.json(
          { detail: "A sample can't be derived from itself or from a sample derived from it" },
          { status: 422 },
        ),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("can't be derived from itself")
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

  it('says when there is no such sample', async () => {
    stubApi({ sample: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Sample not found' })).toBeInTheDocument()
  })

  it('shows an error when the sample cannot be loaded', async () => {
    stubApi({ sample: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load sample')
  })

  it("shows an error when the study's subjects and samples cannot be loaded", async () => {
    stubApi({ samples: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not load the study's subjects and samples.",
    )
  })

  it('highlights the external ID when it is already used', async () => {
    stubApi({
      update: () =>
        Response.json(
          { detail: "External ID 'X-1' is already used by another sample" },
          { status: 409 },
        ),
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another sample in this study already has this external ID.',
    )
    expect(screen.getByLabelText(/external id/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })
})
