import { type LucideIcon, SquarePlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { type Need, useRefusal } from '../permissions'
import { primaryButton } from '../styles'
import { DisabledButton } from './DisabledButton'

// A button-styled link that starts creating a record, with the square-plus icon unless
// another is given. With `need`, it's disabled, saying why, for anyone who can't do it.
export function NewButton({
  to,
  icon: Icon = SquarePlus,
  need,
  align,
  children,
}: {
  to: string
  icon?: LucideIcon
  need?: Need
  align?: 'start' | 'end'
  children: ReactNode
}) {
  const reason = useRefusal(need)
  const className = `${primaryButton} text-sm`

  if (reason) {
    return (
      <DisabledButton icon={Icon} className={className} reason={reason} align={align}>
        {children}
      </DisabledButton>
    )
  }
  return (
    <Link to={to} className={`${className} inline-flex items-center gap-2`}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </Link>
  )
}
