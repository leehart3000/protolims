import { type ReactNode, useId } from 'react'

import { EditButton } from './EditButton'

// The part of a page that its Edit form changes, in a box with the Edit button in its corner,
// so it's clear what the button applies to.
export function DetailsCard({
  editTo,
  editLabel,
  children,
}: {
  editTo: string
  editLabel: string
  children: ReactNode
}) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="mt-6 rounded-lg border border-line bg-panel p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-xl font-semibold">
          Details
        </h2>
        <EditButton to={editTo}>{editLabel}</EditButton>
      </div>
      {children}
    </section>
  )
}
