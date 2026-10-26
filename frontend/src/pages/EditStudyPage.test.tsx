import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import EditStudyPage from './EditStudyPage'

type Study = components['schemas']['StudyRead']

const study: Study = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: 'Gene expression in tumour and normal tissue.',
  design_factors: [
    { name: 'sample type', description: 'tumour or normal' },
    { name: 'stage', description: null },
  ],
  created_at: '2026-10-23T12:00:00Z',
  updated_at: '2026-10-23T12:00:00Z',
  created_by: null,
}

// GET requests load the study; a PATCH saves changes.
function stubApi({
  load = () => Response.json(study),
  update = () => Response.json(study),
}: {
  load?: () => Response
  update?: (request: Request) => Response | Promise<Response>
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) =>
      Promise.resolve(request.method === 'PATCH' ? update(request) : load()),
    ),
  )
}

function renderPage() {
  render(
    <TestProviders route="/projects/TCGA-BRCA/studies/RNASEQ/edit">
      <Routes>
        <Route path="/projects/:code/studies/:studyCode/edit" element={<EditStudyPage />} />
        <Route path="/projects/:code/studies/:studyCode" element={<h1>Study page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

function captureUpdate() {
  const sent: { body?: unknown } = {}
  stubApi({
    update: async (request) => {
      sent.body = await request.json()
      return Response.json(study)
    },
  })
  return sent
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))
}

describe('EditStudyPage', () => {
  it("shows the study's current details, without its code", async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading study…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Title')).toHaveValue('RNA-seq of primary tumours')
    expect(screen.getByText('Edit study:')).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i, { selector: 'textarea' })).toHaveValue(
      'Gene expression in tumour and normal tissue.',
    )
    expect(screen.getByLabelText('Factor 1 name')).toHaveValue('sample type')
    expect(screen.getByLabelText('Factor 1 description')).toHaveValue('tumour or normal')
    expect(screen.getByLabelText('Factor 2 name')).toHaveValue('stage')
    expect(screen.getByLabelText('Factor 2 description')).toHaveValue('')
    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA/studies/RNASEQ',
    )
  })

  it('saves only the changed fields, then goes back to the study', async () => {
    const sent = captureUpdate()
    const user = userEvent.setup()
    renderPage()

    const title = await screen.findByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Tumour RNA-seq')
    await save(user)

    expect(await screen.findByRole('heading', { name: 'Study page' })).toBeInTheDocument()
    expect(sent.body).toEqual({ title: 'Tumour RNA-seq' })
  })

  it('adds, edits and removes design factors, and clears the description', async () => {
    const sent = captureUpdate()
    const user = userEvent.setup()
    renderPage()

    await user.clear(await screen.findByLabelText(/description/i, { selector: 'textarea' }))
    await user.click(screen.getByRole('button', { name: 'Remove factor 2' }))
    await user.click(screen.getByRole('button', { name: 'Add factor' }))
    await user.type(screen.getByLabelText('Factor 2 name'), 'grade')
    await user.type(screen.getByLabelText('Factor 2 description'), ' 1 to 3 ')
    await save(user)

    expect(await screen.findByRole('heading', { name: 'Study page' })).toBeInTheDocument()
    expect(sent.body).toEqual({
      description: null,
      design_factors: [
        { name: 'sample type', description: 'tumour or normal' },
        { name: 'grade', description: '1 to 3' },
      ],
    })
  })

  it('shows that the changes are being saved', async () => {
    stubApi({ update: () => new Promise<Response>(() => undefined) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('says when the details are not valid, and clears the message on change', async () => {
    stubApi({ update: () => Response.json({ detail: [] }, { status: 422 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')

    await user.type(screen.getByLabelText('Title'), '!')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error when the changes cannot be saved', async () => {
    stubApi({ update: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes.')
  })

  it('says when there is no such study', async () => {
    stubApi({ load: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Study not found' })).toBeInTheDocument()
  })

  it('shows an error when the study cannot be loaded', async () => {
    stubApi({ load: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load study')
  })
})
