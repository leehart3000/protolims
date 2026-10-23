import { Fragment } from 'react'

// Label/value pairs; pairs with no value are left out.
export function DetailList({ items }: { items: [string, string | null][] }) {
  return (
    <dl className="mt-6 grid gap-y-1 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-6 sm:gap-y-2">
      {items
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted">{label}</dt>
            <dd className="mb-2 sm:mb-0">{value}</dd>
          </Fragment>
        ))}
    </dl>
  )
}
