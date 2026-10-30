import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'

import { type AllStudySort, fetchAllStudyPage, fetchProject } from '../api/queries'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { NewStudyButton } from '../components/NewStudyButton'
import { PagedTable } from '../components/PagedTable'
import { PageTitle } from '../components/PageTitle'
import { RowArrow } from '../components/RowArrow'
import { SearchBox } from '../components/SearchBox'
import { SortHeader } from '../components/SortHeader'
import {
  errorBox,
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
  textLink,
} from '../styles'
import { useListControls } from '../useListControls'
import { StudyIcon } from '../icons'

type StudyColumn = Exclude<AllStudySort, `-${string}`>

function AllStudiesLink() {
  return (
    <Link to="/studies" className={`${textLink} text-sm`}>
      All studies
    </Link>
  )
}

function ProjectSummary({ projectCode }: { projectCode: string }) {
  const project = useQuery({
    queryKey: ['projects', projectCode],
    queryFn: () => fetchProject(projectCode),
  })

  return (
    <DetailList
      items={[
        ['Project', project.data?.name ?? null],
        ['Project code', <span className="font-mono">{projectCode}</span>],
      ]}
    />
  )
}

// What to say when there's nothing to show.
function emptyText(q: string, projectCode: string | null) {
  if (q) {
    return `No studies match “${q}”.`
  }
  return projectCode ? 'No studies in this project yet.' : 'No studies yet.'
}

function StudyList({ projectCode }: { projectCode: string | null }) {
  const controls = useListControls<AllStudySort>('project')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['studies', { project: projectCode, q, sort, offset, limit }],
    queryFn: () =>
      fetchAllStudyPage({
        project: projectCode ?? undefined,
        q: q || undefined,
        sort,
        limit,
        offset,
      }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-6 text-muted">Loading studies…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-6 ${errorBox}`}>
        Could not load studies. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  function heading(label: string, column: StudyColumn, className: string) {
    return (
      <SortHeader<AllStudySort>
        label={label}
        ascending={column}
        descending={`-${column}` as const}
        sort={sort}
        onSort={changeSort}
        className={className}
      />
    )
  }

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id="study-search"
          label="Search studies"
          placeholder="Search by title, study code or project code"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-6 text-muted">{emptyText(q, projectCode)}</p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <div className={`mt-4 ${tableWrapper}`}>
            <table className={table} aria-label="Studies">
              <thead className={tableHead}>
                <tr>
                  {heading('Study title', 'title', tableHeader)}
                  {heading('Study code', 'code', `${tableHeader} hidden w-px sm:table-cell`)}
                  {heading('Project code', 'project', `${tableHeader} hidden w-px sm:table-cell`)}
                  <th scope="col" className={`${tableHeader} w-px`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((study) => (
                  <tr key={study.id} className={tableRow}>
                    <td className={tableCell}>
                      <Link
                        to={`/projects/${encodeURIComponent(study.project_code)}/studies/${encodeURIComponent(study.code)}`}
                        className={rowLink}
                      >
                        {study.title}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-muted sm:hidden">
                        {study.code} · {study.project_code}
                      </p>
                    </td>
                    <td className={`${tableCell} hidden font-mono whitespace-nowrap sm:table-cell`}>
                      {study.code}
                    </td>
                    <td
                      className={`${tableCell} hidden font-mono whitespace-nowrap text-muted sm:table-cell`}
                    >
                      {study.project_code}
                    </td>
                    <RowArrow />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedTable>
      )}
    </>
  )
}

export default function StudiesPage() {
  const [searchParams] = useSearchParams()
  const projectCode = searchParams.get('project')

  return (
    <>
      {projectCode && (
        <Breadcrumbs
          items={[
            { label: 'Projects', to: '/projects' },
            { label: projectCode, to: `/projects/${encodeURIComponent(projectCode)}`, mono: true },
            { label: 'Studies' },
          ]}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <PageTitle icon={StudyIcon}>Studies</PageTitle>
          {projectCode && <NewStudyButton round projectCode={projectCode} />}
        </div>
        {projectCode && <AllStudiesLink />}
      </div>
      {projectCode && <ProjectSummary projectCode={projectCode} />}
      <StudyList key={projectCode ?? ''} projectCode={projectCode} />
      {projectCode && (
        <div className="mt-4 flex items-center gap-4">
          <NewStudyButton projectCode={projectCode} align="start" />
          <AllStudiesLink />
        </div>
      )}
    </>
  )
}
