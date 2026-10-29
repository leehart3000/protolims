import { EditIcon } from '../icons'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { type Need, useRefusal } from '../permissions'
import { secondaryButton } from '../styles'
import { DisabledButton } from './DisabledButton'

// A button-styled link to a record's edit form. With `need`, it's disabled, saying why, for
// anyone who can't make the change.
export function EditButton({
  to,
  need,
  children,
}: {
  to: string
  need?: Need
  children: ReactNode
}) {
  const reason = useRefusal(need)

  if (reason) {
    return (
      <DisabledButton icon={EditIcon} className={secondaryButton} reason={reason}>
        {children}
      </DisabledButton>
    )
  }
  return (
    <Link to={to} className={`${secondaryButton} inline-flex items-center gap-2`}>
      <EditIcon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </Link>
  )
}
