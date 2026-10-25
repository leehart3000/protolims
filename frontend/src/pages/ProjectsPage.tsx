import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api/client'
import { PageTitle } from '../components/PageTitle'
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
import { RowArrow } from '../components/RowArrow'
import { NewButton } from '../components/NewButton'

async function fetchProjects() {
  const { data } = await api.GET('/api/v1/projects')
  if (!data) {
    throw new Error('Could not load projects')
  }
  return data
}

function ProjectList() {
  const query = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

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

  const projects = query.data
  if (projects.length === 0) {
    return <p className="mt-6 text-muted">No projects yet.</p>
  }

  return (
    <div className={`mt-6 ${tableWrapper}`}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={`${tableHeader} w-px`}>
              Code
            </th>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
              Description
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {projects.map((project) => (
            <tr key={project.id} className={tableRow}>
              <td className={`${tableCell} font-mono whitespace-nowrap`}>{project.code}</td>
              <td className={tableCell}>
                <Link to={`/projects/${encodeURIComponent(project.code)}`} className={rowLink}>
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
