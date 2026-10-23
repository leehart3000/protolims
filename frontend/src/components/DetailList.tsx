import { Fragment, type ReactNode } from 'react'

// Label/value pairs; pairs whose value is null are left out.
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="mt-6 grid gap-y-1 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-3 sm:gap-y-2">
      {items
        .filter(([, value]) => value !== null)
        .map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted">{label}:</dt>
            <dd className="mb-2 font-medium sm:mb-0">{value}</dd>
          </Fragment>
        ))}
    </dl>
  )
}
