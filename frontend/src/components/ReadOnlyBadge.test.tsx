import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { siteAdmin } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import { ReadOnlyBadge } from './ReadOnlyBadge'

describe('ReadOnlyBadge', () => {
  it('shows while the site is read-only, saying why', () => {
    render(
      <TestProviders me={{ ...siteAdmin, read_only: true }}>
        <ReadOnlyBadge />
      </TestProviders>,
    )

    expect(screen.getByText('Read-only').parentElement).toHaveAttribute(
      'title',
      'This site is read-only at the moment, so nothing can be changed.',
    )
  })

  it('shows nothing otherwise', () => {
    render(
      <TestProviders>
        <ReadOnlyBadge />
      </TestProviders>,
    )

    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()
  })
})
