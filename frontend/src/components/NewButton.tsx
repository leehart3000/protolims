import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { primaryButton } from '../styles'

// A button-styled link that starts creating a record, with that kind of record's icon.
export function NewButton({
  to,
  icon: Icon,
  children,
}: {
  to: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${primaryButton} inline-flex items-center gap-2 text-sm`}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </Link>
  )
}
