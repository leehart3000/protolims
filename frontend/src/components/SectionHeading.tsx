import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// A section heading, optionally with an icon.
export function SectionHeading({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-semibold">
      {Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}
      {children}
    </h2>
  )
}
