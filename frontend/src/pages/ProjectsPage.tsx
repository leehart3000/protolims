import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api/client'

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
      <p role="alert" className="mt-6 rounded-lg border border-line bg-panel px-4 py-3">
        Could not load projects. Please try again later.
      </p>
    )
  }

  const projects = query.data
  if (projects.length === 0) {
    return <p className="mt-6 text-muted">No projects yet.</p>
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Code
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="px-4 py-3 align-top font-mono whitespace-nowrap">{project.code}</td>
              <td className="px-4 py-3 align-top">
                <Link
                  to={`/projects/${encodeURIComponent(project.code)}`}
                  className="font-medium text-link underline hover:no-underline"
                >
                  {project.name}
                </Link>
                {project.description && (
                  <p className="mt-1 max-w-56 truncate text-muted sm:hidden">
                    {project.description}
                  </p>
                )}
              </td>
              <td className="hidden px-4 py-3 align-top text-muted sm:table-cell">
                {project.description}
              </td>
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
        <h1 className="text-2xl font-semibold sm:text-3xl">Projects</h1>
        <Link
          to="/projects/new"
          className="rounded-md bg-cobalt px-3 py-2 text-sm font-medium text-white hover:bg-cobalt/90"
        >
          New project
        </Link>
      </div>
      <ProjectList />
    </>
  )
}
