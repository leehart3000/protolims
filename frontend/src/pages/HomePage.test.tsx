import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TestProviders } from '../test/TestProviders'
import HomePage from './HomePage'

const TOTALS: Record<string, number> = {
  '/api/v1/projects': 2,
  '/api/v1/studies': 3,
  '/api/v1/subjects': 1098,
  '/api/v1/samples': 2500,
  '/api/v1/assays': 1,
  '/api/v1/data-files': 0,
}

// Answers each list with its total from TOTALS, or fails for anything in `failing`. Returns
// the requested URLs.
function stubLists(failing: string[] = []) {
  const requested: URL[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      requested.push(url)
      if (failing.includes(url.pathname)) {
        return Promise.resolve(new Response(null, { status: 500 }))
      }
      return Promise.resolve(Response.json({ items: [], total: TOTALS[url.pathname] }))
    }),
  )
  return requested
}

function renderPage() {
  render(
    <TestProviders>
      <HomePage />
    </TestProviders>,
  )
}

describe('HomePage', () => {
  it('links to each kind of record, with how many there are', async () => {
    const requested = stubLists()
    renderPage()

    const cards = screen.getByRole('list', { name: "What's here" })
    expect(await within(cards).findByRole('link', { name: '2 Projects' })).toHaveAttribute(
      'href',
      '/projects',
    )
    for (const [name, href] of [
      ['3 Studies', '/studies'],
      ['1,098 Subjects', '/subjects'],
      ['2,500 Samples', '/samples'],
      ['1 Assay', '/assays'],
      ['0 Data files', '/data-files'],
    ] as const) {
      expect(await within(cards).findByRole('link', { name })).toHaveAttribute('href', href)
    }

    // Only the totals are needed, so each list is asked for just one item.
    expect(requested).toHaveLength(6)
    for (const url of requested) {
      expect(url.searchParams.get('limit')).toBe('1')
    }
  })

  it('shows a dash for a count that could not be loaded', async () => {
    stubLists(['/api/v1/samples'])
    renderPage()

    expect(await screen.findByRole('link', { name: '2 Projects' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '0 Data files' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '– Samples' })).toHaveAttribute('href', '/samples')
  })
})
