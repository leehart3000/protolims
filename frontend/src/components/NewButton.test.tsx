import { render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { TestProviders } from '../test/TestProviders'
import { NewButton } from './NewButton'

describe('NewButton', () => {
  it('can show an icon, hidden from screen readers', () => {
    render(
      <TestProviders route="/">
        <NewButton to="/things/new" icon={Plus}>
          New thing
        </NewButton>
      </TestProviders>,
    )

    const link = screen.getByRole('link', { name: 'New thing' })
    expect(link).toHaveAttribute('href', '/things/new')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
