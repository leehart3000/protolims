import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { nobody, signedInWith } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import { Permitted } from './Permitted'

describe('Permitted', () => {
  it('shows its contents to someone who can use them', () => {
    render(
      <TestProviders>
        <Permitted need={{ siteAdmin: true }}>
          <p>The form</p>
        </Permitted>
      </TestProviders>,
    )

    expect(screen.getByText('The form')).toBeInTheDocument()
  })

  it('asks someone who is not signed in to sign in, coming back here', () => {
    render(
      <TestProviders route="/projects/new" me={nobody}>
        <Permitted need={{ siteAdmin: true }}>
          <p>The form</p>
        </Permitted>
      </TestProviders>,
    )

    expect(screen.queryByText('The form')).not.toBeInTheDocument()
    expect(screen.getByText('Sign in to do this.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with ORCID' })).toHaveAttribute(
      'href',
      '/api/v1/auth/orcid/login?return_to=%2Fprojects%2Fnew',
    )
  })

  it('tells someone signed in why they cannot', () => {
    render(
      <TestProviders me={signedInWith([])}>
        <Permitted need={{ siteAdmin: true }}>
          <p>The form</p>
        </Permitted>
      </TestProviders>,
    )

    expect(screen.getByText('Only site administrators can do this.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows nothing while checking who is signed in', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    )
    render(
      <TestProviders me="fetch">
        <Permitted need={{ siteAdmin: true }}>
          <p>The form</p>
        </Permitted>
      </TestProviders>,
    )

    expect(screen.queryByText('The form')).not.toBeInTheDocument()
    expect(screen.queryByText(/Sign in/)).not.toBeInTheDocument()
  })
})
