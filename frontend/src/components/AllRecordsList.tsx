import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { errorBox } from '../styles'
import { useListControls } from '../useListControls'
import { PagedTable } from './PagedTable'
import { SearchBox } from './SearchBox'

interface PageQuery<S> {
  q?: string
  sort: S
  limit: number
  offset: number
}

// Every record of one kind (subjects, say) in the studies someone can see, a page at a time,
// with sorting and search. `kind` is the plural, in lower case, as in "No subjects yet".
export function AllRecordsList<S extends string, T>({
  kind,
  queryKey,
  initialSort,
  fetchPage,
  placeholder,
  renderTable,
}: {
  kind: string
  queryKey: string
  initialSort: S
  fetchPage: (query: PageQuery<S>) => Promise<{ items: T[]; total: number }>
  placeholder: string
  renderTable: (items: T[], sort: S, onSort: (sort: S) => void) => ReactNode
}) {
  const controls = useListControls<S>(initialSort)
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    // Under the kind's own key, so saving a record of this kind refreshes the list too.
    queryKey: [queryKey, 'all', { q, sort, offset, limit }],
    queryFn: () => fetchPage({ q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-6 text-muted">Loading {kind}…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-6 ${errorBox}`}>
        Could not load {kind}. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id={`${queryKey}-search`}
          label={`Search ${kind}`}
          placeholder={placeholder}
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-6 text-muted">{q ? `No ${kind} match “${q}”.` : `No ${kind} yet.`}</p>
      ) : (
        <PagedTable total={total} controls={controls}>
          {renderTable(items, sort, changeSort)}
        </PagedTable>
      )}
    </>
  )
}
