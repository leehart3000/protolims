import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { fetchProjectPage, type ProjectSort } from '../api/queries'
import { NewButton } from '../components/NewButton'
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
} from '../styles'
import { useListControls } from '../useListControls'

type ProjectColumn = Exclude<ProjectSort, `-${string}`>

function ProjectList() {
  const controls = useListControls<ProjectSort>('code')
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    queryKey: ['projects', { q, sort, offset, limit }],
    queryFn: () => fetchProjectPage({ q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-6 text-muted">Loading projects…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-6 ${errorBox}`}>
        Could not load projects. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  function heading(label: string, column: ProjectColumn, className: string) {
    return (
      <SortHeader<ProjectSort>
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
          id="project-search"
          label="Search projects"
          placeholder="Search by code or name"
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-6 text-muted">{q ? `No projects match “${q}”.` : 'No projects yet.'}</p>
      ) : (
        <PagedTable total={total} controls={controls}>
          <div className={`mt-4 ${tableWrapper}`}>
            <table className={table} aria-label="Projects">
              <thead className={tableHead}>
                <tr>
                  {heading('Code', 'code', `${tableHeader} w-px`)}
                  {heading('Name', 'name', tableHeader)}
                  <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
                    Description
                  </th>
                  <th scope="col" className={`${tableHeader} w-px`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((project) => (
                  <tr key={project.id} className={tableRow}>
                    <td className={`${tableCell} font-mono whitespace-nowrap`}>{project.code}</td>
                    <td className={tableCell}>
                      <Link
                        to={`/projects/${encodeURIComponent(project.code)}`}
                        className={rowLink}
                      >
                        {project.name}
                      </Link>
                      {project.description && (
                        <p className="mt-1 max-w-56 truncate text-muted sm:hidden">
                          {project.description}
                        </p>
                      )}
                    </td>
                    <td className={`${tableCell} hidden text-muted sm:table-cell`}>
                      {project.description}
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

export default function ProjectsPage() {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <PageTitle>Projects</PageTitle>
        <NewButton to="/projects/new">New project</NewButton>
      </div>
      <ProjectList />
      <p className="mt-4">
        <NewButton to="/projects/new">New project</NewButton>
      </p>
    </>
  )
}
