import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { type DataFileSort, fetchDataFilePage } from '../api/queries'
import { errorBox } from '../styles'
import { PAGE_SIZE, useListControls } from '../useListControls'
import { DataFileTable } from './DataFileTable'
import { Pagination } from './Pagination'
import { SearchBox } from './SearchBox'

// A study's data files, or with assayId just that assay's, a page at a time, with sorting
// and search.
export function DataFileList({
  projectCode,
  studyCode,
  assayId,
  emptyText,
}: {
  projectCode: string
  studyCode: string
  assayId?: string
  emptyText: string
}) {
  const { search, q, sort, offset, setOffset, changeSearch, changeSort } =
    useListControls<DataFileSort>('name')
  const query = useQuery({
    queryKey: [
      'projects',
      projectCode,
      'studies',
      studyCode,
      'data-files',
      { assay: assayId, q, sort, offset },
    ],
    queryFn: () =>
      fetchDataFilePage(projectCode, studyCode, {
        assay: assayId,
        q: q || undefined,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading data files…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load data files. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id="data-file-search"
          label="Search data files"
          placeholder="Search by name, external ID or location"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">{q ? `No data files match “${q}”.` : emptyText}</p>
      ) : (
        <>
          <DataFileTable files={items} sort={sort} onSort={changeSort} />
          <Pagination offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} />
        </>
      )}
    </>
  )
}
