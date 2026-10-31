import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { type AssaySampleSort, fetchAssaySamplePage } from '../api/queries'
import { errorBox } from '../styles'
import { useListControls } from '../useListControls'
import { LinkedSampleTable } from './LinkedSampleTable'
import { PagedTable } from './PagedTable'
import { SearchBox } from './SearchBox'

// The samples an assay measured, with their labels in it, to search, sort and page through.
// Shown on the assay's page, and on the page of a file of the assay that has no samples of
// its own (so holds the data of all of them).
export function AssaySampleList({ assayId }: { assayId: string }) {
  const controls = useListControls<AssaySampleSort>('name')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['assays', assayId, 'samples', { q, sort, offset, limit }],
    queryFn: () => fetchAssaySamplePage(assayId, { q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading samples…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load samples. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id="assay-sample-search"
          label="Search samples"
          placeholder="Search by name or external ID"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">
          {q ? `No samples match “${q}”.` : 'No samples linked to this assay yet.'}
        </p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <LinkedSampleTable samples={items} sort={sort} onSort={changeSort} />
        </PagedTable>
      )}
    </>
  )
}
