import { render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { SectionHeading } from './SectionHeading'

describe('SectionHeading', () => {
  it('can show an icon, hidden from screen readers', () => {
    render(<SectionHeading icon={Plus}>Things</SectionHeading>)

    const heading = screen.getByRole('heading', { level: 2, name: 'Things' })
    expect(heading.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
