import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { type AssaySort, fetchAssayPage } from '../api/queries'
import { errorBox } from '../styles'
import { useListControls } from '../useListControls'
import { AssayTable } from './AssayTable'
import { PagedTable } from './PagedTable'
import { SearchBox } from './SearchBox'

// A study's assays, a page at a time, with sorting and search.
export function AssayList({ projectCode, studyCode }: { projectCode: string; studyCode: string }) {
  const controls = useListControls<AssaySort>('name')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode, 'assays', { q, sort, offset, limit }],
    queryFn: () =>
      fetchAssayPage(projectCode, studyCode, {
        q: q || undefined,
        sort,
        limit,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading assays…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load assays. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id="assay-search"
          label="Search assays"
          placeholder="Search by name or external ID"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">
          {q ? `No assays match “${q}”.` : 'No assays in this study yet.'}
        </p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <AssayTable assays={items} sort={sort} onSort={changeSort} />
        </PagedTable>
      )}
    </>
  )
}
