import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('shows the ProtoLIMS name as a link to the home page', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: 'ProtoLIMS' })).toHaveAttribute('href', '/')
  })

  it('links to the source code', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: /source code/i })).toHaveAttribute(
      'href',
      'https://github.com/leehart3000/protolims',
    )
  })
})
