import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import NewProjectPage from './NewProjectPage'

type Project = components['schemas']['ProjectRead']

const created: Project = {
  id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'TCGA-BRCA',
  name: 'TCGA Breast Invasive Carcinoma',
  description: null,
  source_repository: 'GDC',
  licence: null,
  citation: null,
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
    <TestProviders route="/projects/new">
      <Routes>
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:code" element={<h1>Project page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function fillInAndSubmit(user: UserEvent) {
  await user.type(screen.getByLabelText('Code'), 'TCGA-BRCA')
  await user.type(screen.getByLabelText('Name'), 'TCGA Breast Invasive Carcinoma')
  await user.type(screen.getByLabelText(/source repository/i), 'GDC')
  await user.click(screen.getByRole('button', { name: 'Create project' }))
}

describe('NewProjectPage', () => {
  it('creates the project and goes to its page', async () => {
    let sentBody: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        sentBody = await request.json()
        return Response.json(created, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
    expect(sentBody).toEqual({
      code: 'TCGA-BRCA',
      name: 'TCGA Breast Invasive Carcinoma',
      description: null,
      source_repository: 'GDC',
      licence: null,
      citation: null,
    })
  })

  it('says when the code is already in use', async () => {
    respondWith(Response.json({ detail: 'Project code already exists' }, { status: 409 }))
    const user = userEvent.setup()
    renderPage()

    await fillInAndSubmit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A project with the code TCGA-BRCA already exists.',
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the project.')
  })
})
