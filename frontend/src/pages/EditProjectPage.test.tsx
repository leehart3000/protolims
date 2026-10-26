import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import EditProjectPage from './EditProjectPage'

type Project = components['schemas']['ProjectRead']

const project: Project = {
  id: '0192a5b0-0000-7000-8000-000000000001',
  code: 'TCGA-BRCA',
  name: 'TCGA Breast Invasive Carcinoma',
  description: 'Breast cancer cases from The Cancer Genome Atlas.',
  source_repository: 'GDC',
  licence: 'CC BY 4.0',
  citation: null,
  created_at: '2026-10-22T12:00:00Z',
  updated_at: '2026-10-22T12:00:00Z',
  created_by: null,
}

// GET requests load the project; a PATCH saves changes.
function stubApi({
  load = () => Response.json(project),
  update = () => Response.json(project),
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
    <TestProviders route="/projects/TCGA-BRCA/edit">
      <Routes>
        <Route path="/projects/:code/edit" element={<EditProjectPage />} />
        <Route path="/projects/:code" element={<h1>Project page</h1>} />
      </Routes>
    </TestProviders>,
  )
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Save changes' }))
}

describe('EditProjectPage', () => {
  it("shows the project's current details, without its code", async () => {
    stubApi()
    renderPage()

    expect(screen.getByText('Loading project…')).toBeInTheDocument()
    expect(await screen.findByLabelText('Name')).toHaveValue('TCGA Breast Invasive Carcinoma')
    expect(screen.getByText('Edit project:')).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      'Breast cancer cases from The Cancer Genome Atlas.',
    )
    expect(screen.getByLabelText(/source repository/i)).toHaveValue('GDC')
    expect(screen.getByLabelText(/licence/i)).toHaveValue('CC BY 4.0')
    expect(screen.getByLabelText(/citation/i)).toHaveValue('')
    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA',
    )
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'TCGA-BRCA' })).toHaveAttribute(
      'href',
      '/projects/TCGA-BRCA',
    )
  })

  it('saves only the changed fields, then goes back to the project', async () => {
    let sentBody: unknown
    stubApi({
      update: async (request) => {
        sentBody = await request.json()
        return Response.json(project)
      },
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText(/citation/i), 'Cancer Genome Atlas Network (2012)')
    await user.clear(screen.getByLabelText(/licence/i))
    await save(user)

    expect(await screen.findByRole('heading', { name: 'Project page' })).toBeInTheDocument()
    expect(sentBody).toEqual({ licence: null, citation: 'Cancer Genome Atlas Network (2012)' })
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

    await user.type(screen.getByLabelText('Name'), '!')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error when the changes cannot be saved', async () => {
    stubApi({ update: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    const user = userEvent.setup()
    renderPage()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes.')
  })

  it('says when there is no such project', async () => {
    stubApi({ load: () => Response.json({ detail: 'Not Found' }, { status: 404 }) })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
  })

  it('shows an error when the project cannot be loaded', async () => {
    stubApi({ load: () => Response.json({ detail: 'Error' }, { status: 500 }) })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load project')
  })
})
