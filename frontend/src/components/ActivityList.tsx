import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { fetchMyActivity } from '../api/queries'
import type { components } from '../api/schema'
import { formatDateTime } from '../format'
import {
  errorBox,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableWrapper,
  textLink,
} from '../styles'
import { useListControls } from '../useListControls'
import { PagedTable } from './PagedTable'

type Activity = components['schemas']['ActivityRead']

interface Kind {
  noun: string
  path: (item: Activity) => string
}

// What each kind of thing is called, and where its page is.
const KINDS: Record<string, Kind> = {
  project: {
    noun: 'project',
    path: (item) => `/projects/${encodeURIComponent(item.project_code ?? '')}`,
  },
  study: {
    noun: 'study',
    path: (item) =>
      `/projects/${encodeURIComponent(item.project_code ?? '')}/studies/${encodeURIComponent(item.study_code ?? '')}`,
  },
  subject: { noun: 'subject', path: (item) => `/subjects/${item.entity_id}` },
  sample: { noun: 'sample', path: (item) => `/samples/${item.entity_id}` },
  assay: { noun: 'assay', path: (item) => `/assays/${item.entity_id}` },
  data_file: { noun: 'data file', path: (item) => `/data-files/${item.entity_id}` },
}

// What was done, before naming what it was done to, as in "Created" (subject P-1).
function doing(item: Activity) {
  const person = item.person ?? 'someone'
  switch (item.action) {
    case 'create':
      return 'Created'
    case 'update':
      return 'Changed'
    case 'set_member':
      return `Gave ${person} the ${item.role ?? ''} role on`
    case 'remove_member':
      return `Took away ${person}'s role on`
    case 'add_sample':
      return 'Added a sample to'
    case 'update_sample':
      return "Changed a sample's label in"
    case 'remove_sample':
      return 'Removed a sample from'
    case 'add_input':
      return 'Added an input file to'
    case 'remove_input':
      return 'Removed an input file from'
    default:
      return item.action
  }
}

// One change, in words: what was done, and to what, linked to its page if it's still there and
// can be seen; otherwise it says so.
function describe(item: Activity): ReactNode {
  if (item.action === 'remove_user') {
    return `Removed ${item.person ?? 'someone'}, who had never signed in`
  }
  const kind: Kind | undefined = KINDS[item.entity_type]
  const noun = kind?.noun ?? item.entity_type
  if (kind === undefined || item.name === null) {
    return (
      <>
        {doing(item)} a {noun} <span className="text-muted italic">(no longer available)</span>
      </>
    )
  }
  const where =
    item.entity_type === 'project'
      ? null
      : [item.study_code, item.project_code].filter(Boolean).join(' · ')
  return (
    <>
      {doing(item)} {noun}{' '}
      <Link to={kind.path(item)} className={textLink}>
        {item.name}
      </Link>
      {where && <span className="ml-2 font-mono text-xs text-muted">{where}</span>}
    </>
  )
}

// The changes the signed-in person has made, newest first, a page at a time.
export function ActivityList() {
  const controls = useListControls<'newest'>('newest')
  const { offset, limit } = controls
  const query = useQuery({
    queryKey: ['activity', { offset, limit }],
    queryFn: () => fetchMyActivity({ limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-3 text-muted">Loading your changes…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-3 ${errorBox}`}>
        Could not load your changes. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data
  if (total === 0) {
    return <p className="mt-3 text-muted">You haven't made any changes yet.</p>
  }

  return (
    <PagedTable total={total} controls={controls}>
      <div className={`mt-4 ${tableWrapper}`}>
        <table className={table} aria-label="Your changes">
          <thead className={tableHead}>
            <tr>
              <th scope="col" className={`${tableHeader} w-px`}>
                When
              </th>
              <th scope="col" className={tableHeader}>
                What
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item, index) => (
              <tr key={`${item.entity_id}-${String(index + offset)}`}>
                <td className={`${tableCell} text-muted sm:whitespace-nowrap`}>
                  {formatDateTime(item.occurred_at)}
                </td>
                <td className={`${tableCell} wrap-anywhere`}>{describe(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PagedTable>
  )
}
