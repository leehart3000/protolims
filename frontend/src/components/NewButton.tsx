import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { NewIcon } from '../icons'
import { type Need, useRefusal } from '../permissions'
import { primaryButton } from '../styles'
import { DisabledButton } from './DisabledButton'

// A button-styled link that starts creating a record, with the New icon unless another is
// given. With `need`, it's disabled, saying why, for anyone who can't do it.
//
// With `short`, it just says "Add", for beside a heading that already names the kind of
// record; its full name ("Add sample", from "New sample") is for screen readers and the
// tooltip. The labelled version goes at the end of the section.
export function NewButton({
  to,
  icon: Icon = NewIcon,
  need,
  align,
  short = false,
  children,
}: {
  to: string
  icon?: LucideIcon
  need?: Need
  align?: 'start' | 'end'
  short?: boolean
  children: string
}) {
  const reason = useRefusal(need)
  const className = `${primaryButton} text-sm`
  const fullName = short ? children.replace(/^New /, 'Add ') : undefined
  const text = short ? 'Add' : children

  if (reason) {
    return (
      <DisabledButton
        icon={Icon}
        className={className}
        reason={reason}
        align={align}
        label={fullName}
      >
        {text}
      </DisabledButton>
    )
  }
  return (
    <Link
      to={to}
      aria-label={fullName}
      title={fullName}
      className={`${className} inline-flex items-center gap-2`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {text}
    </Link>
  )
}
