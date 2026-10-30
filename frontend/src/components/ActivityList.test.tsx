import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { components } from '../api/schema'
import { TestProviders } from '../test/TestProviders'
import { ActivityList } from './ActivityList'

type Activity = components['schemas']['ActivityRead']

function activity(fields: Partial<Activity>): Activity {
  return {
    occurred_at: '2026-10-30T17:58:00Z',
    action: 'create',
    entity_type: 'subject',
    entity_id: '0192a5b0-0000-7000-8000-000000000005',
    name: 'P-1',
    project_code: 'P1',
    study_code: 'S1',
    person: null,
    role: null,
    ...fields,
  }
}

// Answers the activity list with `items` (or an error), and returns each request's query.
function stubActivity(items: Activity[] | 'error') {
  const queries: URLSearchParams[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      queries.push(new URL(request.url).searchParams)
      if (items === 'error') {
        return Promise.resolve(new Response(null, { status: 500 }))
      }
      return Promise.resolve(Response.json({ items, total: items.length }))
    }),
  )
  return queries
}

function renderList() {
  render(
    <TestProviders>
      <ActivityList />
    </TestProviders>,
  )
}

async function rowTexts() {
  const table = await screen.findByRole('table', { name: 'Your changes' })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent)
}

describe('ActivityList', () => {
  it('says what was done, and to what, newest first', async () => {
    const queries = stubActivity([
      activity({ action: 'remove_user', entity_type: 'user', name: null, person: 'X' }),
      activity({ action: 'remove_member', entity_type: 'project', name: 'P one', person: 'Y' }),
      activity({
        action: 'set_member',
        entity_type: 'study',
        name: 'S one',
        person: 'Y',
        role: 'editor',
      }),
      activity({ action: 'update', entity_type: 'sample', name: 'T-1' }),
      activity({ action: 'add_sample', entity_type: 'assay', name: 'Run-1' }),
      activity({ action: 'update_sample', entity_type: 'assay', name: 'Run-1' }),
      activity({ action: 'remove_sample', entity_type: 'data_file', name: 'a.bam' }),
      activity({ action: 'add_input', entity_type: 'data_file', name: 'a.bam' }),
      activity({ action: 'remove_input', entity_type: 'data_file', name: 'a.bam' }),
      activity({ action: 'create', name: null, project_code: null, study_code: null }),
      activity({ action: 'archive', entity_type: 'thing', name: 'X' }),
    ])
    renderList()

    expect(await rowTexts()).toEqual([
      'Removed X, who had never signed in',
      "Took away Y's role on project P one",
      'Gave Y the editor role on study S oneS1 · P1',
      'Changed sample T-1S1 · P1',
      'Added a sample to assay Run-1S1 · P1',
      "Changed a sample's label in assay Run-1S1 · P1",
      'Removed a sample from data file a.bamS1 · P1',
      'Added an input file to data file a.bamS1 · P1',
      'Removed an input file from data file a.bamS1 · P1',
      'Created a subject (no longer available)',
      'archive a thing (no longer available)',
    ])
    expect(screen.getByRole('link', { name: 'P one' })).toHaveAttribute('href', '/projects/P1')
    expect(screen.getByRole('link', { name: 'S one' })).toHaveAttribute(
      'href',
      '/projects/P1/studies/S1',
    )
    expect(screen.getByRole('link', { name: 'T-1' })).toHaveAttribute(
      'href',
      '/samples/0192a5b0-0000-7000-8000-000000000005',
    )
    // Shown in the browser's time zone, so only the format is checked.
    expect(screen.getAllByText(/^30 Oct 2026, \d\d:\d\d$/)).toHaveLength(11)
    expect(queries[0]?.get('offset')).toBe('0')
  })

  it('says when there are no changes yet', async () => {
    stubActivity([])
    renderList()

    expect(await screen.findByText("You haven't made any changes yet.")).toBeInTheDocument()
  })

  it('says when the changes could not be loaded', async () => {
    stubActivity('error')
    renderList()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your changes')
  })
})
