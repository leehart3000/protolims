import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'

import { api } from '../api/client'
import { fetchProject } from '../api/queries'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { NewStudyButton } from '../components/NewStudyButton'
import { PageTitle } from '../components/PageTitle'
import {
  errorBox,
  rowChevron,
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
  textLink,
} from '../styles'

async function fetchStudies(projectCode: string | null) {
  const { data } = await api.GET('/api/v1/studies', {
    params: { query: { project: projectCode ?? undefined } },
  })
  if (!data) {
    throw new Error('Could not load studies')
  }
  return data
}

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

function StudyList({ projectCode }: { projectCode: string | null }) {
  const query = useQuery({
    queryKey: ['studies', { project: projectCode }],
    queryFn: () => fetchStudies(projectCode),
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

  const studies = query.data
  if (studies.length === 0) {
    return (
      <p className="mt-6 text-muted">
        {projectCode ? 'No studies in this project yet.' : 'No studies yet.'}
      </p>
    )
  }

  return (
    <div className={`mt-6 ${tableWrapper}`}>
      <table className={table}>
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Study title
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Study code
            </th>
            <th scope="col" className={`${tableHeader} hidden w-px sm:table-cell`}>
              Project code
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {studies.map((study) => (
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
        <PageTitle>Studies</PageTitle>
        {projectCode && (
          <div className="flex items-center gap-4">
            <AllStudiesLink />
            <NewStudyButton projectCode={projectCode} />
          </div>
        )}
      </div>
      {projectCode && <ProjectSummary projectCode={projectCode} />}
      <StudyList projectCode={projectCode} />
      {projectCode && (
        <div className="mt-4 flex items-center gap-4">
          <NewStudyButton projectCode={projectCode} />
          <AllStudiesLink />
        </div>
      )}
    </>
  )
}
