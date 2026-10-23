import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewStudyPage from './NewStudyPage'

type Study = components['schemas']['StudyRead']

const created: Study = {
  id: '0192a5b0-0000-7000-8000-000000000002',
  project_id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'TCGA-BRCA-RNASEQ',
  title: 'RNA-seq of primary tumours',
  description: null,
  design_factors: [],
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

function renderPage() {
  render(
    <TestProviders route="/projects/TCGA-BRCA/studies/new">
      <Routes>
        <Route path="/projects/:code/studies/new" element={<NewStudyPage />} />
        <Route path="/projects/:code" element={<h1>Project page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  const codeInput = screen.getByLabelText('Code')
  await user.clear(codeInput)
  await user.type(codeInput, 'TCGA-BRCA-RNASEQ')
  await user.type(screen.getByLabelText('Title'), 'RNA-seq of primary tumours')
  await user.click(screen.getByRole('button', { name: 'Create study' }))
}

describe('NewStudyPage', () => {
  it('creates the study and goes back to the project', async () => {
    let sentPath = ''
    let sentBody: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        sentPath = new URL(request.url).pathname
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
    expect(sentPath).toBe('/api/v1/projects/TCGA-BRCA/studies')
    expect(sentBody).toEqual({
      code: 'TCGA-BRCA-RNASEQ',
      title: 'RNA-seq of primary tumours',
      description: null,
    })
  })

  it('shows that the study is being created', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  it('highlights the code when it is already in use, and clears it on change', async () => {
    respondWith(Response.json({ detail: 'Study code already exists' }, { status: 409 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A study with the code TCGA-BRCA-RNASEQ already exists in this project.',
    )
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('Code'), '-2')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Code')).not.toHaveAttribute('aria-invalid')
  })

  it('says when the project does not exist', async () => {
    respondWith(Response.json({ detail: 'Project not found' }, { status: 404 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is no project with the code TCGA-BRCA.',
    )
  })

  it('says when the details are not valid', async () => {
    respondWith(Response.json({ detail: [] }, { status: 422 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Some of the details are not valid.')
  })

  it('shows an error when the API fails', async () => {
    respondWith(Response.json({ detail: 'Internal error' }, { status: 500 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the study.')
  })
})
