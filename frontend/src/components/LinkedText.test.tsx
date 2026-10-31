import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LinkedText } from './LinkedText'

describe('LinkedText', () => {
  it('turns web addresses into links, leaving out the punctuation after them', () => {
    const { container } = render(
      <LinkedText text="See https://example.org/terms. Cite (https://doi.org/10.1/x), or https://a.org/b" />,
    )

    expect(
      screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['https://example.org/terms', 'https://example.org/terms'],
      ['https://doi.org/10.1/x', 'https://doi.org/10.1/x'],
      ['https://a.org/b', 'https://a.org/b'],
    ])
    expect(container).toHaveTextContent(
      'See https://example.org/terms. Cite (https://doi.org/10.1/x), or https://a.org/b',
    )
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('leaves other text as it is, including addresses that are not https', () => {
    render(<LinkedText text={'CC BY 4.0\nhttp://example.org and javascript:alert(1)'} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(/CC BY 4\.0/)).toHaveClass('whitespace-pre-line')
  })
})
