import { Link } from 'react-router'

import { textLink } from '../styles'

interface Crumb {
  label: string
  to?: string
  mono?: boolean
}

// Crumbs with a link lead back up the hierarchy; the last one (no link) is the current page.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${String(index)}-${item.label}`} className="flex items-center gap-x-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-muted">
                ›
              </span>
            )}
            {item.to ? (
              <Link to={item.to} className={`${textLink} ${item.mono ? 'font-mono' : ''}`}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={`font-medium ${item.mono ? 'font-mono' : ''}`}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
