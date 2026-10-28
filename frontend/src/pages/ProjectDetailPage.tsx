import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { fetchProject, fetchStudyPage, type StudySort } from '../api/queries'
import type { components } from '../api/schema'
import { DetailList } from '../components/DetailList'
import { DetailsCard } from '../components/DetailsCard'
import { NewStudyButton } from '../components/NewStudyButton'
import { PagedTable } from '../components/PagedTable'
import { PageTitle } from '../components/PageTitle'
import { RowArrow } from '../components/RowArrow'
import { SearchBox } from '../components/SearchBox'
import { SortHeader } from '../components/SortHeader'
import { formatDate } from '../format'
import {
  errorBox,
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'
import { useListControls } from '../useListControls'

type Project = components['schemas']['ProjectRead']
type StudyColumn = Exclude<StudySort, `-${string}`>

function StudyList({ projectCode }: { projectCode: string }) {
  const controls = useListControls<StudySort>('code')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies', { q, sort, offset, limit }],
    queryFn: () => fetchStudyPage(projectCode, { q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading studies…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load studies. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  function heading(label: string, column: StudyColumn, className: string) {
    return (
      <SortHeader<StudySort>
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
          id="project-study-search"
          label="Search studies"
          placeholder="Search by code or title"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-4 text-muted">
          {q ? `No studies match “${q}”.` : 'No studies in this project yet.'}
        </p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <div className={`mt-4 ${tableWrapper}`}>
            <table className={table} aria-label="Studies">
              <thead className={tableHead}>
                <tr>
                  {heading('Code', 'code', `${tableHeader} w-px`)}
                  {heading('Title', 'title', tableHeader)}
                  <th scope="col" className={`${tableHeader} w-px`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((study) => (
                  <tr key={study.id} className={tableRow}>
                    <td className={`${tableCell} font-mono whitespace-nowrap`}>{study.code}</td>
                    <td className={tableCell}>
                      <Link
                        to={`/projects/${encodeURIComponent(projectCode)}/studies/${encodeURIComponent(study.code)}`}
                        className={rowLink}
                      >
                        {study.title}
                      </Link>
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

function ProjectDetails({ project }: { project: Project }) {
  return (
    <>
      <PageTitle label="Project">{project.name}</PageTitle>

      <DetailsCard
        editTo={`/projects/${encodeURIComponent(project.code)}/edit`}
        editLabel="Edit project"
      >
        {project.description && <p className="mt-3 max-w-3xl text-muted">{project.description}</p>}
        <DetailList
          items={[
            ['Code', <span className="font-mono">{project.code}</span>],
            ['Source repository', project.source_repository],
            ['Licence', project.licence],
            ['Citation', project.citation],
            ['Created', formatDate(project.created_at)],
          ]}
        />
      </DetailsCard>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Studies</h2>
        <NewStudyButton projectCode={project.code} />
      </div>
      <StudyList projectCode={project.code} />
      <p className="mt-4">
        <NewStudyButton projectCode={project.code} />
      </p>
    </>
  )
}

function ProjectContent({ code }: { code: string }) {
  const query = useQuery({ queryKey: ['projects', code], queryFn: () => fetchProject(code) })

  if (query.isPending) {
    return <p className="text-muted">Loading project…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load project. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Project not found</PageTitle>
        <p className="mt-3 text-muted">
          There is no project with the code <span className="font-mono">{code}</span>.
        </p>
      </>
    )
  }

  return <ProjectDetails project={query.data} />
}

export default function ProjectDetailPage() {
  const { code = '' } = useParams()

  return <ProjectContent code={code} />
}
