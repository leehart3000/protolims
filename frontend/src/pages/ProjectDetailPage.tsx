import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'

type Project = components['schemas']['ProjectRead']

async function fetchProject(code: string) {
  const { data, response } = await api.GET('/api/v1/projects/{code}', {
    params: { path: { code } },
  })
  if (response.status === 404) {
    return null
  }
  if (!data) {
    throw new Error('Could not load project')
  }
  return data
}

async function fetchStudies(projectCode: string) {
  const { data } = await api.GET('/api/v1/projects/{project_code}/studies', {
    params: { path: { project_code: projectCode } },
  })
  if (!data) {
    throw new Error('Could not load studies')
  }
  return data
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function StudyList({ projectCode }: { projectCode: string }) {
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies'],
    queryFn: () => fetchStudies(projectCode),
  })

  if (query.isPending) {
    return <p className="mt-4 text-muted">Loading studies…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className="mt-4 rounded-lg border border-line bg-panel px-4 py-3">
        Could not load studies. Please try again later.
      </p>
    )
  }

  const studies = query.data
  if (studies.length === 0) {
    return <p className="mt-4 text-muted">No studies in this project yet.</p>
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Code
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Title
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {studies.map((study) => (
            <tr key={study.id}>
              <td className="px-4 py-3 align-top font-mono whitespace-nowrap">{study.code}</td>
              <td className="px-4 py-3 align-top">{study.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProjectDetails({ project }: { project: Project }) {
  const details: [string, string | null][] = [
    ['Source repository', project.source_repository],
    ['Licence', project.licence],
    ['Citation', project.citation],
    ['Created', formatDate(project.created_at)],
  ]

  return (
    <>
      <p className="font-mono text-sm text-muted">{project.code}</p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{project.name}</h1>
      {project.description && <p className="mt-3 max-w-3xl text-muted">{project.description}</p>}

      <dl className="mt-6 space-y-2 text-sm">
        {details
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="sm:flex sm:gap-6">
              <dt className="text-muted sm:w-40 sm:shrink-0">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      <h2 className="mt-10 text-xl font-semibold">Studies</h2>
      <StudyList projectCode={project.code} />
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
      <p role="alert" className="rounded-lg border border-line bg-panel px-4 py-3">
        Could not load project. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <h1 className="text-2xl font-semibold sm:text-3xl">Project not found</h1>
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

  return (
    <>
      <p className="mb-6 text-sm">
        <Link to="/projects" className="text-link underline hover:no-underline">
          ← All projects
        </Link>
      </p>
      <ProjectContent code={code} />
    </>
  )
}
