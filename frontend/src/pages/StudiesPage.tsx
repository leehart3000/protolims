import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'

import { api } from '../api/client'
import { Breadcrumbs } from '../components/Breadcrumbs'
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
            <th scope="col" className={`${tableHeader} w-px`}>
              Project
            </th>
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
              <td className={`${tableCell} font-mono whitespace-nowrap text-muted`}>
                {study.project_code}
              </td>
              <td className={`${tableCell} font-mono whitespace-nowrap`}>{study.code}</td>
              <td className={tableCell}>
                <Link
                  to={`/projects/${encodeURIComponent(study.project_code)}/studies/${encodeURIComponent(study.code)}`}
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
      <div className="flex items-center justify-between gap-4">
        <PageTitle>Studies</PageTitle>
        {projectCode && <NewStudyButton projectCode={projectCode} />}
      </div>
      {projectCode && (
        <p className="mt-2 text-sm text-muted">
          Showing studies in project <span className="font-mono">{projectCode}</span>.{' '}
          <Link to="/studies" className={textLink}>
            Show all studies
          </Link>
        </p>
      )}
      <StudyList projectCode={projectCode} />
      {projectCode && (
        <p className="mt-4">
          <NewStudyButton projectCode={projectCode} />
        </p>
      )}
    </>
  )
}
