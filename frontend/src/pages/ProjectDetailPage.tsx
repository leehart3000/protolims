import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'

import { api } from '../api/client'
import type { components } from '../api/schema'
import { DetailList } from '../components/DetailList'
import { formatDate } from '../format'
import {
  errorBox,
  primaryButton,
  rowChevron,
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'

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
      <p role="alert" className={`mt-4 ${errorBox}`}>
        Could not load studies. Please try again later.
      </p>
    )
  }

  const studies = query.data
  if (studies.length === 0) {
    return <p className="mt-4 text-muted">No studies in this project yet.</p>
  }

  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={`${tableHeader} w-px`}>
              Code
            </th>
            <th scope="col" className={tableHeader}>
              Title
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {studies.map((study) => (
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
              <td className={`${tableCell} ${rowChevron}`} aria-hidden="true">
                ›
              </td>
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

      <DetailList items={details} />

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Studies</h2>
        <Link
          to={`/projects/${encodeURIComponent(project.code)}/studies/new`}
          className={`${primaryButton} text-sm`}
        >
          New study
        </Link>
      </div>
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
      <p role="alert" className={errorBox}>
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
