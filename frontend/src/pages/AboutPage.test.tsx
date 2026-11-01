import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { nobody, siteAdmin } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import AboutPage from './AboutPage'
import PrivacyPage from './PrivacyPage'

describe('AboutPage', () => {
  it('says how this site is used: public and read-only, as protolims.org is', () => {
    render(
      <TestProviders me={{ ...nobody, read_only: true }}>
        <AboutPage />
      </TestProviders>,
    )

    expect(
      screen.getByText(
        "Anyone can browse this site, without signing in. It's read-only at the moment, so nothing can be changed.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'source code (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://github.com/leehart3000/protolims',
    )
    const docs = screen.getByRole('link', { name: '/api/docs (opens in a new tab)' })
    expect(docs).toHaveAttribute('target', '_blank')
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says how this site is used: private, and open to changes by those with a role', () => {
    render(
      <TestProviders me={{ ...siteAdmin, public_read: false }}>
        <AboutPage />
      </TestProviders>,
    )

    expect(screen.getByText(/This site is private/)).toHaveTextContent(
      'People given a role on a project or study can add and change its records',
    )
  })

  it("leaves that out until it's known", () => {
    // Who's signed in (and how the site is set up) never arrives.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )
    render(
      <TestProviders me="fetch">
        <AboutPage />
      </TestProviders>,
    )

    expect(screen.queryByText(/browse this site|This site is private/)).not.toBeInTheDocument()
  })
})

describe('PrivacyPage', () => {
  it("names who runs the site and who processes data for it, from the site's settings", () => {
    render(
      <TestProviders>
        <PrivacyPage />
      </TestProviders>,
    )

    expect(screen.getByText(/This site is run by Lee Hart, personally/)).toBeInTheDocument()
    expect(screen.getByText(/hosts the database, on AWS in London/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: "the Information Commissioner's Office (opens in a new tab)",
      }),
    ).toHaveAttribute('href', 'https://ico.org.uk')
  })
})
