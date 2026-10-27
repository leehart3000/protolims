import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { fetchSamplePage, type SampleSort } from '../api/queries'
import { errorBox } from '../styles'
import { PAGE_SIZE, useListControls } from '../useListControls'
import { Pagination } from './Pagination'
import { SampleTable } from './SampleTable'
import { SearchBox } from './SearchBox'

// A study's samples, or with subjectId just that subject's, a page at a time, with sorting
// and search.
export function SampleList({
  projectCode,
  studyCode,
  subjectId,
  emptyText,
}: {
  projectCode: string
  studyCode: string
  subjectId?: string
  emptyText: string
}) {
  const { search, q, sort, offset, setOffset, changeSearch, changeSort } =
    useListControls<SampleSort>('name')
  const query = useQuery({
    queryKey: [
      'projects',
      projectCode,
      'studies',
      studyCode,
      'samples',
      { subject: subjectId, q, sort, offset },
    ],
    queryFn: () =>
      fetchSamplePage(projectCode, studyCode, {
        subject: subjectId,
        q: q || undefined,
        sort,
        limit: PAGE_SIZE,
        offset,
      }),
    // Keep showing the current page while the next one loads, so the table doesn't flicker.
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
          id="sample-search"
          label="Search samples"
          placeholder="Search by name or external ID"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">{q ? `No samples match “${q}”.` : emptyText}</p>
      ) : (
        <>
          <SampleTable samples={items} label="Samples" sort={sort} onSort={changeSort} />
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            total={total}
            filtered={q !== ''}
            onChange={setOffset}
          />
        </>
      )}
    </>
  )
}
