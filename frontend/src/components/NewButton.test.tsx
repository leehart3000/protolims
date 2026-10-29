import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import type { components } from '../api/schema'
import { editorOf } from '../permissions'
import { nobody, signedInWith } from '../test/people'
import { TestProviders } from '../test/TestProviders'
import { EditButton } from './EditButton'
import { NewButton } from './NewButton'

type Me = components['schemas']['Me']

function renderButtons(me: Me) {
  render(
    <TestProviders me={me}>
      <NewButton to="/things/new" need={editorOf('P1', 'S1')} align="start">
        New thing
      </NewButton>
      <EditButton to="/things/1/edit" need={editorOf('P1', 'S1')}>
        Edit thing
      </EditButton>
    </TestProviders>,
  )
}

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

  it('links to the form for someone who can use it', () => {
    renderButtons(signedInWith([{ project: 'P1', study: 'S1', role: 'editor' }]))

    expect(screen.getByRole('link', { name: 'New thing' })).toHaveAttribute('href', '/things/new')
    expect(screen.getByRole('link', { name: 'Edit thing' })).toHaveAttribute(
      'href',
      '/things/1/edit',
    )
  })

  it('is disabled for anyone else, saying why', async () => {
    renderButtons(nobody)

    const button = screen.getByRole('button', { name: 'New thing' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Sign in to do this.')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    // Clicking it does nothing.
    await userEvent.setup().click(button)
    expect(screen.getByRole('button', { name: 'New thing' })).toBeInTheDocument()
  })

  it("explains when someone's role isn't enough", () => {
    renderButtons(signedInWith([{ project: 'P1', study: null, role: 'viewer' }]))

    expect(screen.getByRole('button', { name: 'Edit thing' })).toHaveAccessibleDescription(
      "Only the study's editors and admins can do this.",
    )
  })
})
