import { SquarePen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { secondaryButton } from '../styles'

// A button-styled link to a record's edit form.
export function EditButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${secondaryButton} inline-flex items-center gap-2`}>
      <SquarePen aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </Link>
  )
}
