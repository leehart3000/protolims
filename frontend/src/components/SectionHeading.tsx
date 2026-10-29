import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// A section heading, optionally with an icon (for a kind of record, the one in icons.ts).
export function SectionHeading({
  icon: Icon,
  className = '',
  children,
}: {
  icon?: LucideIcon
  className?: string
  children: ReactNode
}) {
  return (
    <h2 className={`flex items-center gap-2 text-xl font-semibold ${className}`}>
      {Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}
      {children}
    </h2>
  )
}
