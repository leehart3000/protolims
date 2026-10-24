import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { api } from '../api/client'
import { fetchProject } from '../api/queries'
import type { components } from '../api/schema'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailList } from '../components/DetailList'
import { PageTitle } from '../components/PageTitle'
import { formatDate } from '../format'
import { errorBox } from '../styles'

type Study = components['schemas']['StudyRead']

async function fetchStudy(projectCode: string, studyCode: string) {
  const { data, response } = await api.GET('/api/v1/projects/{project_code}/studies/{study_code}', {
    params: { path: { project_code: projectCode, study_code: studyCode } },
  })
  if (response.status === 404) {
    return null
  }
  if (!data) {
    throw new Error('Could not load study')
  }
  return data
}

function StudyDetails({ projectCode, study }: { projectCode: string; study: Study }) {
  const project = useQuery({
    queryKey: ['projects', projectCode],
    queryFn: () => fetchProject(projectCode),
  })

  return (
    <>
      <PageTitle label="Study">{study.title}</PageTitle>
      {study.description && <p className="mt-3 max-w-3xl text-muted">{study.description}</p>}

      <DetailList
        items={[
          ['Study code', <span className="font-mono">{study.code}</span>],
          ['Created', formatDate(study.created_at)],
          ['Project', project.data?.name ?? null],
          ['Project code', <span className="font-mono">{projectCode}</span>],
        ]}
      />

      <h2 className="mt-10 text-xl font-semibold">Design factors</h2>
      {study.design_factors.length === 0 ? (
        <p className="mt-4 text-muted">No design factors recorded.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {study.design_factors.map((factor, index) => (
            <li key={`${String(index)}-${factor.name}`}>
              <span className="font-medium">{factor.name}</span>
              {factor.description && <span className="text-muted"> – {factor.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function StudyContent({ projectCode, studyCode }: { projectCode: string; studyCode: string }) {
  const query = useQuery({
    queryKey: ['projects', projectCode, 'studies', studyCode],
    queryFn: () => fetchStudy(projectCode, studyCode),
  })

  if (query.isPending) {
    return <p className="text-muted">Loading study…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={errorBox}>
        Could not load study. Please try again later.
      </p>
    )
  }

  if (query.data === null) {
    return (
      <>
        <PageTitle>Study not found</PageTitle>
        <p className="mt-3 text-muted">
          There is no study with the code <span className="font-mono">{studyCode}</span> in project{' '}
          <span className="font-mono">{projectCode}</span>.
        </p>
      </>
    )
  }

  return <StudyDetails projectCode={projectCode} study={query.data} />
}

export default function StudyDetailPage() {
  const { code: projectCode = '', studyCode = '' } = useParams()

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Projects', to: '/projects' },
          { label: projectCode, to: `/projects/${encodeURIComponent(projectCode)}`, mono: true },
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(projectCode)}` },
          { label: studyCode, mono: true },
        ]}
      />
      <StudyContent projectCode={projectCode} studyCode={studyCode} />
    </>
  )
}
