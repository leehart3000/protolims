import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { NewIcon } from '../icons'
import { type Need, useRefusal } from '../permissions'
import { primaryButton } from '../styles'
import { DisabledButton } from './DisabledButton'

// A small round button: just the icon, beside a heading. Its words are kept for screen readers
// and shown as a tooltip.
const roundButton =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

// A button-styled link that starts creating a record, with the New icon unless another is
// given. With `need`, it's disabled, saying why, for anyone who can't do it. With `round`, it's
// a small round button showing just the icon, for beside a heading; the labelled version goes
// at the end of the section.
export function NewButton({
  to,
  icon: Icon = NewIcon,
  need,
  align,
  round = false,
  children,
}: {
  to: string
  icon?: LucideIcon
  need?: Need
  align?: 'start' | 'end'
  round?: boolean
  children: string
}) {
  const reason = useRefusal(need)
  const className = round ? roundButton : `${primaryButton} text-sm`
  const content: ReactNode = round ? <span className="sr-only">{children}</span> : children

  if (reason) {
    return (
      <DisabledButton
        icon={Icon}
        className={className}
        reason={reason}
        align={align}
        label={round ? children : undefined}
      >
        {content}
      </DisabledButton>
    )
  }
  return (
    <Link
      to={to}
      title={round ? children : undefined}
      className={`${className} inline-flex items-center gap-2`}
    >
      <Icon aria-hidden="true" className={round ? 'size-5 shrink-0' : 'size-4 shrink-0'} />
      {content}
    </Link>
  )
}
