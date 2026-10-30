import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import { TokensSection } from './TokensSection'

type Token = components['schemas']['ApiTokenRead']

const imports: Token = {
  id: '0192a5b0-0000-7000-8000-0000000000d1',
  name: 'GDC imports',
  hint: 'plt_AbCd',
  created_at: '2026-10-30T19:00:00Z',
  expires_at: '2099-01-28T19:00:00Z',
  last_used_at: null,
}

const old: Token = {
  ...imports,
  id: '0192a5b0-0000-7000-8000-0000000000d2',
  name: 'Old script',
  hint: 'plt_WxYz',
  created_at: '2025-01-01T09:00:00Z',
  expires_at: '2025-04-01T09:00:00Z',
  last_used_at: '2025-02-03T10:00:00Z',
}

// A stand-in for the API's tokens: lists them, makes one (or refuses, with `makeStatus`), and
// revokes them. Returns the requests made, as "METHOD path body".
function stubTokens(tokens: Token[], { makeStatus = 201, revokeStatus = 204 } = {}) {
  const requests: string[] = []
  let current = [...tokens]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname
      const body = request.method === 'POST' ? await request.text() : ''
      requests.push(`${request.method} ${path} ${body}`.trim())
      if (request.method === 'POST') {
        if (makeStatus !== 201) {
          return new Response(null, { status: makeStatus })
        }
        const made = { ...imports, id: 'new', name: 'Nightly', token: 'plt_TheWholeSecret' }
        current = [made, ...current]
        return Response.json(made, { status: 201 })
      }
      if (request.method === 'DELETE') {
        if (revokeStatus !== 204) {
          return new Response(null, { status: revokeStatus })
        }
        current = current.filter((token) => !path.endsWith(token.id))
        return new Response(null, { status: 204 })
      }
      if (path === '/api/v1/auth/me/activity') {
        return Response.json({ items: [], total: 0 })
      }
      return Response.json(current)
    }),
  )
  return requests
}

function renderSection() {
  render(
    <TestProviders>
      <TokensSection />
    </TestProviders>,
  )
}

describe('TokensSection', () => {
  it('lists tokens, with when each expires and was last used', async () => {
    stubTokens([imports, old])
    renderSection()

    const table = await screen.findByRole('table', { name: 'Your API tokens' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      'GDC importsplt_AbCd…30 October 202628 January 2099Last used: neverRevoke',
      'Old scriptplt_WxYz…1 January 2025ExpiredLast used: 3 February 2025Revoke',
    ])
  })

  it('says when there are none', async () => {
    stubTokens([])
    renderSection()

    expect(await screen.findByText('You have no API tokens.')).toBeInTheDocument()
  })

  it('makes a token and shows it once, ready to copy', async () => {
    const requests = stubTokens([])
    const user = userEvent.setup()
    renderSection()

    await user.type(screen.getByLabelText("What it's for"), '  Nightly  ')
    await user.selectOptions(screen.getByLabelText('Lasts'), '30')
    await user.click(screen.getByRole('button', { name: 'Make token' }))

    const box = await screen.findByRole('status')
    expect(box).toHaveTextContent('plt_TheWholeSecret')
    expect(box).toHaveTextContent('you won’t be able to see it again')
    expect(requests).toContain('POST /api/v1/auth/me/tokens {"name":"Nightly","days":30}')
    // The form is ready for another.
    expect(screen.getByLabelText("What it's for")).toHaveValue('')
    expect(screen.getByLabelText('Lasts')).toHaveValue('90')

    await user.click(within(box).getByRole('button', { name: 'Copy' }))
    expect(await within(box).findByText('Copied.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('plt_TheWholeSecret')

    expect(await screen.findByRole('table', { name: 'Your API tokens' })).toHaveTextContent(
      'Nightly',
    )
    await user.click(within(box).getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('plt_TheWholeSecret')).not.toBeInTheDocument()
  })

  it('says so when copying fails', async () => {
    stubTokens([])
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    renderSection()

    await user.type(screen.getByLabelText("What it's for"), 'Nightly')
    await user.click(screen.getByRole('button', { name: 'Make token' }))
    await user.click(await screen.findByRole('button', { name: 'Copy' }))

    expect(await screen.findByText(/Couldn’t copy it/)).toBeInTheDocument()
  })

  it('says why a token could not be made', async () => {
    stubTokens([], { makeStatus: 401 })
    const user = userEvent.setup()
    renderSection()

    await user.type(screen.getByLabelText("What it's for"), 'Nightly')
    await user.click(screen.getByRole('button', { name: 'Make token' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("you're not signed in")
  })

  it('revokes a token once that is confirmed', async () => {
    const requests = stubTokens([imports, old])
    const user = userEvent.setup()
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Revoke GDC imports' }))
    expect(screen.getByText(/Anything using it will stop working/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Anything using it will stop working/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Revoke GDC imports' }))
    await user.click(screen.getByRole('button', { name: 'Yes, revoke' }))

    await waitFor(() => {
      expect(screen.queryByText('GDC imports')).not.toBeInTheDocument()
    })
    expect(requests).toContain(`DELETE /api/v1/auth/me/tokens/${imports.id}`)
    expect(screen.getByText('Old script')).toBeInTheDocument()
  })

  it('says why a token could not be revoked', async () => {
    stubTokens([imports], { revokeStatus: 500 })
    const user = userEvent.setup()
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Revoke GDC imports' }))
    await user.click(screen.getByRole('button', { name: 'Yes, revoke' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not revoke the token')
  })

  it('says when the tokens could not be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    )
    renderSection()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your API tokens')
  })
})
