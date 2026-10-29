import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// A page heading in the wordmark's style: an optional "Label:" like "Proto",
// then the title like "LIMS". With `icon`, the kind of record the page is about (from
// icons.ts) comes first, so it's clear at a glance what sort of page this is.
export function PageTitle({
  label,
  icon: Icon,
  children,
}: {
  label?: string
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <h1 className="flex items-start gap-2.5 font-brand text-2xl tracking-tight sm:text-3xl">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-primary sm:mt-1 sm:size-7"
        />
      )}
      <span>
        {label && (
          <>
            <span className="font-normal text-fg">{label}:</span>{' '}
          </>
        )}
        <span className="font-bold">{children}</span>
      </span>
    </h1>
  )
}
